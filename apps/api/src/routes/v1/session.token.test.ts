import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import type { RenderRepo } from "@usetagih/core";
import {
	API_SCOPES,
	ApiErrorEnvelopeSchema,
	NOT_IMPLEMENTED_CODE,
	ROUTE_SCOPE_REQUIREMENTS,
	SESSION_TOKEN_SCOPES,
} from "@usetagih/schema";
import { createApp } from "../../app.js";
import { hashApiKeySecret } from "../../auth/api-key-crypto.js";
import {
	signSessionBearerToken,
	signSessionBearerTokenRaw,
} from "../../auth/session-token.js";
import { createCsrfToken, verifyCsrfToken } from "../../middleware/csrf.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();
setDefaultTimeout(15_000);

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

const stubRenderRepo: RenderRepo = {
	async insert() {
		throw new Error("unexpected render insert in scope parity tests");
	},
	async getById() {
		return null;
	},
	async getByIdAndWorkspace() {
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
};

describe("session token scope parity matrix", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			otelEnabled: false,
			renderRepo: stubRenderRepo,
			resolveAuditUserId: async () => "00000000-0000-4000-8000-000000000001",
		});
	});

	const stubMatrix = [
		{ route: "/v1/renders", method: "POST", scope: "renders:write" as const },
		{ route: "/v1/audit", method: "GET", scope: "audit:read" as const },
		{ route: "/v1/webhooks", method: "GET", scope: "webhooks:manage" as const },
		{
			route: "/v1/webhooks",
			method: "POST",
			scope: "webhooks:manage" as const,
		},
	] as const;

	const validateMatrix = [
		{
			route: "/v1/invoices/validate",
			method: "POST",
			scope: "renders:write" as const,
		},
		{
			route: "/v1/quotations/validate",
			method: "POST",
			scope: "renders:write" as const,
		},
		{
			route: "/v1/receipts/validate",
			method: "POST",
			scope: "renders:write" as const,
		},
	] as const;

	const previewMatrix = [
		{
			route: "/v1/invoices/preview",
			method: "POST",
			scope: "renders:write" as const,
		},
		{
			route: "/v1/quotations/preview",
			method: "POST",
			scope: "renders:write" as const,
		},
		{
			route: "/v1/receipts/preview",
			method: "POST",
			scope: "renders:write" as const,
		},
	] as const;

	const rendersRetrievalMatrix = [
		{ route: "/v1/renders", method: "GET", scope: "renders:read" as const },
		{
			route: "/v1/renders/rnd_00000000-0000-4000-8000-000000000099",
			method: "GET",
			scope: "renders:read" as const,
		},
		{
			route: "/v1/renders/rnd_00000000-0000-4000-8000-000000000099/download",
			method: "GET",
			scope: "renders:read" as const,
		},
	] as const;

	const scopeRegistryMatrix = [
		...stubMatrix,
		...validateMatrix,
		...previewMatrix,
		...rendersRetrievalMatrix,
	] as const;

	for (const row of stubMatrix) {
		test(`session bearer ${row.method} ${row.route} with ${row.scope} → 501`, async () => {
			const signed = await signSessionBearerToken(
				{
					userId: crypto.randomUUID(),
					workspaceId: crypto.randomUUID(),
				},
				env,
			);

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${signed.accessToken}`,
					},
				}),
			);

			expect(response.status).toBe(501);
			const body = ApiErrorEnvelopeSchema.parse(await response.json());
			expect(body.error.code).toBe(NOT_IMPLEMENTED_CODE);
			const requestIdHeader = response.headers.get("X-Request-Id");
			expect(requestIdHeader).not.toBeNull();
			if (!requestIdHeader) throw new Error("expected X-Request-Id header");
			expect(body.error.requestId).toBe(requestIdHeader);
		});

		test(`API key ${row.method} ${row.route} with ${row.scope} → 501`, async () => {
			const workspaceId = crypto.randomUUID();
			const { secret } = await createTestApiKey(apiKeyRepo, {
				workspaceId,
				scopes: [...API_SCOPES],
			});

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${secret}`,
					},
				}),
			);

			expect(response.status).toBe(501);
			const body = ApiErrorEnvelopeSchema.parse(await response.json());
			expect(body.error.code).toBe(NOT_IMPLEMENTED_CODE);
			const requestIdHeader = response.headers.get("X-Request-Id");
			expect(requestIdHeader).not.toBeNull();
			if (!requestIdHeader) throw new Error("expected X-Request-Id header");
			expect(body.error.requestId).toBe(requestIdHeader);
		});
	}

	for (const row of validateMatrix) {
		test(`session bearer ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const signed = await signSessionBearerToken(
				{
					userId: crypto.randomUUID(),
					workspaceId: crypto.randomUUID(),
				},
				env,
			);

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${signed.accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});

		test(`API key ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const workspaceId = crypto.randomUUID();
			const { secret } = await createTestApiKey(apiKeyRepo, {
				workspaceId,
				scopes: [row.scope],
			});

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});
	}

	for (const row of previewMatrix) {
		test(`session bearer ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const signed = await signSessionBearerToken(
				{
					userId: crypto.randomUUID(),
					workspaceId: crypto.randomUUID(),
				},
				env,
			);

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${signed.accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});

		test(`API key ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const workspaceId = crypto.randomUUID();
			const { secret } = await createTestApiKey(apiKeyRepo, {
				workspaceId,
				scopes: [row.scope],
			});

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});
	}

	for (const row of rendersRetrievalMatrix) {
		test(`session bearer ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const signed = await signSessionBearerToken(
				{
					userId: crypto.randomUUID(),
					workspaceId: crypto.randomUUID(),
				},
				env,
			);

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${signed.accessToken}`,
					},
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});

		test(`API key ${row.method} ${row.route} with ${row.scope} passes scope guard`, async () => {
			const workspaceId = crypto.randomUUID();
			const { secret } = await createTestApiKey(apiKeyRepo, {
				workspaceId,
				scopes: [row.scope],
			});

			const response = await app.handle(
				new Request(`http://localhost${row.route}`, {
					method: row.method,
					headers: {
						Authorization: `Bearer ${secret}`,
					},
				}),
			);

			expect(response.status).not.toBe(401);
			expect(response.status).not.toBe(403);
		});
	}

	test("ROUTE_SCOPE_REQUIREMENTS aligns with matrix routes", () => {
		for (const row of scopeRegistryMatrix) {
			const normalizedRoute = row.route.replace(
				/\/rnd_[0-9a-f-]{36}(?=\/|$)/gi,
				"/{renderId}",
			);
			const key =
				`${row.method} ${normalizedRoute}` as keyof typeof ROUTE_SCOPE_REQUIREMENTS;
			expect(ROUTE_SCOPE_REQUIREMENTS[key]).toContain(row.scope);
		}
	});

	test("JWT with subset scp missing renders:read → 403 FORBIDDEN on GET /v1/renders", async () => {
		const userId = crypto.randomUUID();
		const workspaceId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: userId,
				wid: workspaceId,
				scp: ["audit:read"],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error.code).toBe("FORBIDDEN");
	});

	test("API key with subset scopes missing renders:read → 403 FORBIDDEN on GET /v1/renders", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["audit:read"],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error.code).toBe("FORBIDDEN");
	});

	test("API key prefix collision resolves second candidate when first is revoked", async () => {
		const workspaceId = crypto.randomUUID();
		const sharedPrefix = "utk_live_collid1";
		const revokedSecret = `${sharedPrefix}RevokedKeySuffix0000000001`;
		const activeSecret = `${sharedPrefix}ActiveKeySuffix00000000001`;

		expect(revokedSecret.length).toBeGreaterThanOrEqual(40);
		expect(activeSecret.length).toBeGreaterThanOrEqual(40);
		expect(revokedSecret.slice(0, 16)).toBe(sharedPrefix);
		expect(activeSecret.slice(0, 16)).toBe(sharedPrefix);

		const revokedHash = await hashApiKeySecret(revokedSecret);
		const revoked = await apiKeyRepo.create({
			workspaceId,
			name: "Revoked collision",
			prefix: sharedPrefix,
			keyHash: revokedHash,
			scopes: [...API_SCOPES],
		});
		await apiKeyRepo.revoke(workspaceId, revoked.id);

		const activeHash = await hashApiKeySecret(activeSecret);
		await apiKeyRepo.create({
			workspaceId,
			name: "Active collision",
			prefix: sharedPrefix,
			keyHash: activeHash,
			scopes: [...API_SCOPES],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${activeSecret}` },
			}),
		);

		expect(response.status).toBe(200);
		const listBody = (await response.json()) as {
			renders: unknown[];
			total: number;
		};
		expect(Array.isArray(listBody.renders)).toBe(true);
	});

	test("wrong algorithm token → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
			{ algorithm: "HS384" },
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("missing typ claim → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
			{ omitClaims: ["typ"] },
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("future iat → 401", async () => {
		const future = Math.floor(Date.now() / 1000) + 600;
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: future,
				exp: future + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("malformed scp → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: ["not-a-real-scope"],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("expired JWT → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now - 1200,
				exp: now - 300,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("wrong aud → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: env.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: "https://evil.example/api",
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("wrong azp → 401", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: "https://evil.example",
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: env.USETAGIH_API_PUBLIC_URL,
				iss: env.USETAGIH_API_PUBLIC_URL,
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/renders", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(401);
	});

	test("session-bound CSRF rejection helper", () => {
		const sessionA = crypto.randomUUID();
		const sessionB = crypto.randomUUID();
		const tokenForA = createCsrfToken(env.BETTER_AUTH_SECRET, sessionA);
		expect(verifyCsrfToken(env.BETTER_AUTH_SECRET, sessionB, tokenForA)).toBe(
			false,
		);
	});
});
