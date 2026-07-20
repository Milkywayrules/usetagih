/**
 * Integration tests for preview endpoints.
 * Skipped when compose Postgres is unreachable (probeDb false).
 * Typst compile cases skipped when Typst binary is absent.
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
import { createDb, probeDb } from "@usetagih/db";
import { resolveTypstBinaryPath } from "@usetagih/render";
import invoiceModernBasic from "../../../../packages/render/__fixtures__/payloads/invoice-modern-basic.json";
import { createApp } from "../app.js";
import { initTestLogger } from "../test-helpers/evlog.js";

initTestLogger();

const postgresUp = await probeDb();
const typstAvailable = existsSync(resolveTypstBinaryPath());
if (postgresUp) setDefaultTimeout(60_000);

const describeIntegration = postgresUp ? describe : describe.skip;
const previewTest = typstAvailable
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

describeIntegration("preview integration", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	const { db, sql } = createDb();
	const jar = new AuthCookieJar();

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
				email: `preview-${id}@example.com`,
				password: "password123",
				name: "Preview User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-${id}`,
			}),
		});
		jar.absorb(signup);
		expect(signup.status).toBe(200);

		const createKey = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "Preview key",
				scopes: ["renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	previewTest(
		"API key POST /v1/invoices/preview → 200 multi-page SVG body",
		async () => {
			const id = suffix();
			const apiKey = await signUpAndCreateApiKey(id);

			const response = await fetch(`${base}/v1/invoices/preview`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceModernBasic),
			});

			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				valid: boolean;
				pageCount: number;
				pages: Array<{ index: number; svg: string }>;
				html: string;
			};
			expect(body.valid).toBe(true);
			expect(body.pageCount).toBeGreaterThanOrEqual(1);
			expect(body.pages[0]?.svg).toMatch(/^<svg/i);
			expect(body.html).toContain('class="page"');
		},
	);
});

if (!typstAvailable) {
	test("typst binary missing — preview integration compile skipped", () => {
		console.warn(
			`Skipping preview integration compile: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}
