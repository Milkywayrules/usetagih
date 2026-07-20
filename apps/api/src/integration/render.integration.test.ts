/**
 * Integration tests for sync render endpoints.
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
import type { RenderUseCaseDeps } from "@usetagih/core";
import { createDb, probeDb } from "@usetagih/db";
import { resolveTypstBinaryPath } from "@usetagih/render";
import invoiceModernBasic from "../../../../packages/render/__fixtures__/payloads/invoice-modern-basic.json";
import { createApp } from "../app.js";
import type { RenderRuntimeDeps } from "../lib/render-deps.js";
import { initTestLogger } from "../test-helpers/evlog.js";

initTestLogger();

const postgresUp = await probeDb();
const typstAvailable = existsSync(resolveTypstBinaryPath());
if (postgresUp) setDefaultTimeout(60_000);

const describeIntegration = postgresUp ? describe : describe.skip;
const renderTest = typstAvailable
	? (name: string, fn: () => void | Promise<void>) => test(name, fn, 60_000)
	: test.skip;

const P95_SMOKE_BUDGET_MS = 2_000;

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

describeIntegration("render integration", () => {
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
				email: `render-${id}@example.com`,
				password: "password123",
				name: "Render User",
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
				name: "Render key",
				scopes: ["renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	renderTest(
		"API key POST /v1/invoices/render → 201 completed body within P95 smoke budget",
		async () => {
			const id = suffix();
			const apiKey = await signUpAndCreateApiKey(id);
			const started = Date.now();

			const response = await fetch(`${base}/v1/invoices/render`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"Idempotency-Key": `render-smoke-${id}`,
				},
				body: JSON.stringify(invoiceModernBasic),
			});

			const elapsedMs = Date.now() - started;
			expect(response.status).toBe(201);
			expect(response.headers.get("Location")).toMatch(/^\/v1\/renders\/rnd_/);

			const body = (await response.json()) as {
				renderId: string;
				status: string;
				shareUrl: string;
				expiresAt: string;
				schemaVersion: string;
				documentType: string;
				template: string;
			};

			expect(body.renderId.startsWith("rnd_")).toBe(true);
			expect(body.status).toBe("completed");
			expect(body.documentType).toBe("invoice");
			expect(body.template).toBe("modern");
			expect(body.shareUrl).toContain("/share/");
			expect(elapsedMs).toBeLessThanOrEqual(P95_SMOKE_BUDGET_MS);
		},
	);
});

if (!typstAvailable) {
	test("typst binary missing — render integration compile skipped", () => {
		console.warn(
			`Skipping render integration compile: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}

describeIntegration("render integration mocked timing", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	const { db, sql } = createDb();
	const jar = new AuthCookieJar();

	function createFastMockRenderRuntime(): RenderRuntimeDeps {
		const baseDeps: RenderUseCaseDeps = {
			resolveLogoDeps: {
				ingestFromUrl: async () => {
					throw new Error("unexpected logo fetch");
				},
				getStoredLogo: async () => null,
				storeLogo: async () => {},
			},
			templateExists: () => true,
			renderPdfFromPayload: () => ({
				pdfBytes: new Uint8Array([37, 80, 68, 70]),
				sha256: "mock",
				byteSize: 4,
			}),
			renderRepo: {
				async insert(input) {
					return {
						...input,
						id: input.id ?? crypto.randomUUID(),
						createdAt: new Date(),
						updatedAt: new Date(),
					};
				},
				async getByIdAndWorkspace() {
					return null;
				},
				async getById() {
					return null;
				},
				async revokeShare() {
					return null;
				},
				async listByWorkspace() {
					return [];
				},
				async listByWorkspacePaginated() {
					return { items: [], total: 0 };
				},
			},
			artifactStore: {
				async put({ body }) {
					return { sha256: "mock", byteSize: body.byteLength };
				},
				async get() {
					return null;
				},
				async delete() {},
			},
			shareSigningSecret: "dev-only-share-signing-secret-min-32-chars",
		};

		return {
			logoBlobStore: {} as RenderRuntimeDeps["logoBlobStore"],
			artifactStore: baseDeps.artifactStore,
			createRenderUseCaseDeps: () => baseDeps,
		};
	}

	beforeAll(() => {
		app = createApp({ db, renderRuntime: createFastMockRenderRuntime() });
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
				email: `render-mock-${id}@example.com`,
				password: "password123",
				name: "Render Mock User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-mock-${id}`,
			}),
		});
		jar.absorb(signup);
		expect(signup.status).toBe(200);

		const createKey = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "Render mock key",
				scopes: ["renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	test("mocked render path completes within P95 smoke budget", async () => {
		const id = suffix();
		const apiKey = await signUpAndCreateApiKey(id);
		const started = Date.now();

		const response = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": `render-mock-smoke-${id}`,
			},
			body: JSON.stringify(invoiceModernBasic),
		});

		const elapsedMs = Date.now() - started;
		expect(response.status).toBe(201);
		expect(elapsedMs).toBeLessThanOrEqual(P95_SMOKE_BUDGET_MS);
	});
});
