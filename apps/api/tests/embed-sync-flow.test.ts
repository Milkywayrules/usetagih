/**
 * SM-4 sync embed flow integration test: validate → render → idempotent retry → download → share.
 * Skipped when compose Postgres is unreachable. Typst compile skipped when binary absent.
 */
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	setDefaultTimeout,
	test,
} from "bun:test";
import { existsSync } from "node:fs";
import { createDb, probeDb, schema } from "@usetagih/db";
import { resolveTypstBinaryPath } from "@usetagih/render";
import { and, desc, eq, inArray } from "drizzle-orm";
import invoiceModernBasic from "../../../packages/render/__fixtures__/payloads/invoice-modern-basic.json";
import { createApp } from "../src/app.js";
import { initTestLogger } from "../src/test-helpers/evlog.js";

initTestLogger();

const postgresUp = await probeDb();
const typstAvailable = existsSync(resolveTypstBinaryPath());
if (postgresUp) setDefaultTimeout(60_000);

const describeIntegration = postgresUp ? describe : describe.skip;
const embedFlowTest = typstAvailable
	? (name: string, fn: () => void | Promise<void>) => test(name, fn, 60_000)
	: test.skip;

class AuthCookieJar {
	private readonly cookies = new Map<string, string>();

	absorb(response: Response) {
		for (const line of response.headers.getSetCookie()) {
			const pair = line.split(";")[0];
			const separator = pair?.indexOf("=");
			if (pair && separator != null && separator > 0) {
				this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
			}
		}
	}

	headers(extra: Record<string, string> = {}): Record<string, string> {
		const headers = { ...extra };
		if (this.cookies.size > 0) {
			headers.cookie = [...this.cookies.entries()]
				.map(([name, value]) => `${name}=${value}`)
				.join("; ");
		}
		return headers;
	}
}

function suffix() {
	return crypto.randomUUID().slice(0, 8);
}

describeIntegration("SM-4 sync embed flow integration", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	const { db, sql } = createDb();
	const jar = new AuthCookieJar();
	let workspaceId: string;

	beforeAll(() => {
		app = createApp({ db });
		app.listen(0);
		const port = app.server?.port ?? 0;
		base = `http://127.0.0.1:${port}`;
	});

	afterAll(async () => {
		app.stop();
		await sql.end({ timeout: 1 });
	});

	async function signUpAndCreateApiKey(id: string) {
		const signup = await fetch(`${base}/api/auth/sign-up-with-workspace`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: `embed-sm4-${id}@example.com`,
				password: "password123",
				name: "Embed SM-4 User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-${id}`,
			}),
		});
		jar.absorb(signup);
		expect(signup.status).toBe(200);
		const signupBody = (await signup.json()) as { workspaceId: string };
		workspaceId = signupBody.workspaceId;

		const createKey = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "Embed flow key",
				scopes: ["renders:read", "renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	embedFlowTest(
		"validate → render → idempotent retry → download → share with audit trail",
		async () => {
			const id = suffix();
			const apiKey = await signUpAndCreateApiKey(id);
			const authHeaders = {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			};
			const payload = JSON.stringify(invoiceModernBasic);

			const validateResponse = await fetch(`${base}/v1/invoices/validate`, {
				method: "POST",
				headers: authHeaders,
				body: payload,
			});
			expect(validateResponse.status).toBe(200);
			const validateBody = (await validateResponse.json()) as {
				valid: boolean;
				normalizedPreview: { documentType: string; schemaVersion: string };
			};
			expect(validateBody.valid).toBe(true);
			expect(validateBody.normalizedPreview.documentType).toBe("invoice");
			expect(validateBody.normalizedPreview.schemaVersion).toBe("2026-07-20");

			const idempotencyKey = `embed-sm4-${id}`;
			const renderHeaders = {
				...authHeaders,
				"Idempotency-Key": idempotencyKey,
			};

			const firstRender = await fetch(`${base}/v1/invoices/render`, {
				method: "POST",
				headers: renderHeaders,
				body: payload,
			});
			expect(firstRender.status).toBe(201);
			const firstBody = (await firstRender.json()) as {
				renderId: string;
				status: string;
				shareUrl: string;
				documentType: string;
			};
			expect(firstBody.renderId.startsWith("rnd_")).toBe(true);
			expect(firstBody.status).toBe("completed");
			expect(firstBody.documentType).toBe("invoice");
			expect(firstBody.shareUrl).toContain("/share/");

			const retryRender = await fetch(`${base}/v1/invoices/render`, {
				method: "POST",
				headers: renderHeaders,
				body: payload,
			});
			expect(retryRender.status).toBe(201);
			expect(await retryRender.json()).toEqual(firstBody);

			const downloadResponse = await fetch(
				`${base}/v1/renders/${firstBody.renderId}/download`,
				{ headers: { Authorization: `Bearer ${apiKey}` } },
			);
			expect(downloadResponse.status).toBe(200);
			expect(downloadResponse.headers.get("Content-Type")).toBe(
				"application/pdf",
			);
			const pdfBytes = new Uint8Array(await downloadResponse.arrayBuffer());
			expect(pdfBytes.byteLength).toBeGreaterThan(0);
			expect(pdfBytes[0]).toBe(0x25);
			expect(pdfBytes[1]).toBe(0x50);

			const shareToken = decodeURIComponent(
				new URL(firstBody.shareUrl).pathname.split("/share/")[1] ?? "",
			);
			const shareResponse = await fetch(
				`${base}/v1/share/${encodeURIComponent(shareToken)}`,
			);
			expect(shareResponse.status).toBe(200);
			const shareBody = (await shareResponse.json()) as {
				renderId: string;
				downloadUrl: string;
			};
			expect(shareBody.renderId).toBe(firstBody.renderId);
			expect(shareBody.downloadUrl).toContain("/download");

			const publicDownload = await fetch(`${base}${shareBody.downloadUrl}`);
			expect(publicDownload.status).toBe(200);
			expect(publicDownload.headers.get("Content-Type")).toBe(
				"application/pdf",
			);
			const publicPdf = new Uint8Array(await publicDownload.arrayBuffer());
			expect(publicPdf.byteLength).toBeGreaterThan(0);
			expect(publicPdf[0]).toBe(0x25);

			const auditRows = await db
				.select()
				.from(schema.auditEvents)
				.where(
					and(
						eq(schema.auditEvents.workspaceId, workspaceId),
						inArray(schema.auditEvents.action, [
							"validate",
							"render",
							"render.download",
						]),
					),
				)
				.orderBy(desc(schema.auditEvents.createdAt));

			const actions = new Set(auditRows.map((row) => row.action));
			expect(actions.has("validate")).toBe(true);
			expect(actions.has("render")).toBe(true);
			expect(actions.has("render.download")).toBe(true);
			expect(
				auditRows.some(
					(row) =>
						row.action === "render" && row.resourceId === firstBody.renderId,
				),
			).toBe(true);
			expect(
				auditRows.some(
					(row) =>
						row.action === "render.download" &&
						row.resourceId === firstBody.renderId,
				),
			).toBe(true);
		},
	);
});

if (!typstAvailable) {
	test("typst binary missing — SM-4 embed flow compile skipped", () => {
		console.warn(
			`Skipping SM-4 embed flow: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}
