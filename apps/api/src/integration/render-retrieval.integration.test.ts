/**
 * Integration tests for render retrieval (list, get, download).
 * Skipped when compose Postgres is unreachable.
 * Render fixture cases skipped when Typst binary is absent.
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
import { and, desc, eq } from "drizzle-orm";
import invoiceModernBasic from "../../../../packages/render/__fixtures__/payloads/invoice-modern-basic.json";
import { createApp } from "../app.js";
import { initTestLogger } from "../test-helpers/evlog.js";

initTestLogger();

const postgresUp = await probeDb();
const typstAvailable = existsSync(resolveTypstBinaryPath());
if (postgresUp) setDefaultTimeout(60_000);

const describeIntegration = postgresUp ? describe : describe.skip;
const retrievalTest = typstAvailable
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

describeIntegration("render retrieval integration", () => {
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
				email: `retrieval-${id}@example.com`,
				password: "password123",
				name: "Retrieval User",
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
				name: "Retrieval key",
				scopes: ["renders:read", "renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	retrievalTest(
		"render → list → get → download round-trip with audit",
		async () => {
			const id = suffix();
			const apiKey = await signUpAndCreateApiKey(id);

			const renderResponse = await fetch(`${base}/v1/invoices/render`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"Idempotency-Key": `retrieval-${id}`,
				},
				body: JSON.stringify(invoiceModernBasic),
			});
			expect(renderResponse.status).toBe(201);
			const rendered = (await renderResponse.json()) as { renderId: string };
			expect(rendered.renderId.startsWith("rnd_")).toBe(true);

			const listResponse = await fetch(`${base}/v1/renders?pageSize=20`, {
				headers: { Authorization: `Bearer ${apiKey}` },
			});
			expect(listResponse.status).toBe(200);
			const listed = (await listResponse.json()) as {
				renders: Array<{
					renderId: string;
					idempotencyFingerprint: string | null;
				}>;
				total: number;
			};
			expect(listed.total).toBeGreaterThanOrEqual(1);
			expect(
				listed.renders.some((row) => row.renderId === rendered.renderId),
			).toBe(true);

			const getResponse = await fetch(
				`${base}/v1/renders/${rendered.renderId}`,
				{
					headers: { Authorization: `Bearer ${apiKey}` },
				},
			);
			expect(getResponse.status).toBe(200);
			const metadata = (await getResponse.json()) as {
				renderId: string;
				status: string;
				shareUrl: string;
			};
			expect(metadata.renderId).toBe(rendered.renderId);
			expect(metadata.status).toBe("completed");
			expect(metadata.shareUrl).toContain("/share/");

			const downloadResponse = await fetch(
				`${base}/v1/renders/${rendered.renderId}/download`,
				{
					headers: { Authorization: `Bearer ${apiKey}` },
				},
			);
			expect(downloadResponse.status).toBe(200);
			expect(downloadResponse.headers.get("Content-Type")).toBe(
				"application/pdf",
			);
			expect(downloadResponse.headers.get("Content-Disposition")).toContain(
				"attachment",
			);
			const pdfBytes = new Uint8Array(await downloadResponse.arrayBuffer());
			expect(pdfBytes.byteLength).toBeGreaterThan(0);
			expect(pdfBytes[0]).toBe(0x25);
			expect(pdfBytes[1]).toBe(0x50);

			const auditRows = await db
				.select()
				.from(schema.auditEvents)
				.where(
					and(
						eq(schema.auditEvents.workspaceId, workspaceId),
						eq(schema.auditEvents.action, "render.download"),
					),
				)
				.orderBy(desc(schema.auditEvents.createdAt));
			expect(
				auditRows.some((row) => row.resourceId === rendered.renderId),
			).toBe(true);

			const crossWorkspaceKey = await (async () => {
				const otherId = suffix();
				return signUpAndCreateApiKey(otherId);
			})();

			const crossGet = await fetch(`${base}/v1/renders/${rendered.renderId}`, {
				headers: { Authorization: `Bearer ${crossWorkspaceKey}` },
			});
			expect(crossGet.status).toBe(404);
		},
	);
});
