/**
 * Integration tests for session bearer token exchange.
 * Skipped when compose Postgres is unreachable (probeDb false).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDb, probeDb } from "@usetagih/db";
import { SESSION_TOKEN_SCOPES } from "@usetagih/schema";
import { createApp } from "../app.js";
import {
	signSessionBearerTokenRaw,
	verifySessionBearerToken,
} from "../auth/session-token.js";
import { parseApiEnv } from "../env.js";
import {
	CSRF_HEADER,
	createCsrfToken,
	readCsrfCookie,
} from "../middleware/csrf.js";

const postgresUp = await probeDb();
const describeIntegration = postgresUp
	? (name: string, fn: () => void) => describe(name, fn, { timeout: 15_000 })
	: describe.skip;
const testEnv = parseApiEnv();

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

describeIntegration("session token integration", () => {
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

	async function signUpWithWorkspace(id: string) {
		const response = await fetch(`${base}/api/auth/sign-up-with-workspace`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: `session-${id}@example.com`,
				password: "password123",
				name: "Session User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-${id}`,
			}),
		});
		jar.absorb(response);
		expect(response.status).toBe(200);
		return response.json() as Promise<{
			workspaceId: string;
			session: { id: string };
		}>;
	}

	test("sign-up → GET /v1/session/csrf → POST /v1/session/token → 200 with valid JWT", async () => {
		const id = suffix();
		const signup = await signUpWithWorkspace(id);

		const csrfResponse = await fetch(`${base}/v1/session/csrf`, {
			headers: jar.headers(),
		});
		jar.absorb(csrfResponse);
		expect(csrfResponse.status).toBe(200);

		const csrfRequest = new Request(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers(),
		});
		const csrfToken =
			readCsrfCookie(csrfRequest, false) ?? readCsrfCookie(csrfRequest, true);
		expect(csrfToken).toBeTruthy();

		const tokenResponse = await fetch(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers({ [CSRF_HEADER]: csrfToken ?? "" }),
		});

		expect(tokenResponse.status).toBe(200);
		const body = (await tokenResponse.json()) as {
			accessToken: string;
			tokenType: string;
			expiresIn: number;
			scopes: string[];
			workspaceId: string;
		};

		expect(body.tokenType).toBe("Bearer");
		expect(body.expiresIn).toBeLessThanOrEqual(900);
		expect(body.scopes).toEqual([...SESSION_TOKEN_SCOPES]);
		expect(body.workspaceId).toBe(signup.workspaceId);

		const verified = await verifySessionBearerToken(body.accessToken, testEnv);
		expect(verified?.workspaceId).toBe(signup.workspaceId);
	});

	test("POST /v1/session/token without CSRF → 403", async () => {
		const id = suffix();
		await signUpWithWorkspace(`csrf-missing-${id}`);

		const response = await fetch(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers(),
		});

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error.code).toBe("FORBIDDEN");
	});

	test("POST /v1/session/token without session → 401", async () => {
		const response = await fetch(`${base}/v1/session/token`, {
			method: "POST",
			headers: { [CSRF_HEADER]: "noop.token" },
		});
		expect(response.status).toBe(401);
	});

	test("GET /v1/session/csrf without session → 401", async () => {
		const response = await fetch(`${base}/v1/session/csrf`);
		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error.code).toBe("UNAUTHORIZED");
	});

	async function exchangeSessionBearer(): Promise<string> {
		const csrfResponse = await fetch(`${base}/v1/session/csrf`, {
			headers: jar.headers(),
		});
		jar.absorb(csrfResponse);
		const csrfRequest = new Request(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers(),
		});
		const csrfToken = readCsrfCookie(csrfRequest, false);
		const tokenResponse = await fetch(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers({ [CSRF_HEADER]: csrfToken ?? "" }),
		});
		expect(tokenResponse.status).toBe(200);
		const { accessToken } = (await tokenResponse.json()) as {
			accessToken: string;
		};
		return accessToken;
	}

	test("Bearer token on GET /v1/renders → 501", async () => {
		const id = suffix();
		await signUpWithWorkspace(`bearer-${id}`);

		const accessToken = await exchangeSessionBearer();

		const rendersResponse = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		expect(rendersResponse.status).toBe(501);
	});

	test("expired JWT → 401", async () => {
		const id = suffix();
		await signUpWithWorkspace(`expired-${id}`);
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: testEnv.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now - 1200,
				exp: now - 300,
				aud: testEnv.USETAGIH_API_PUBLIC_URL,
				iss: testEnv.USETAGIH_API_PUBLIC_URL,
			},
			testEnv,
		);

		const response = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(response.status).toBe(401);
	});

	test("JWT with wrong aud → 401", async () => {
		const id = suffix();
		await signUpWithWorkspace(`wrong-aud-${id}`);
		const now = Math.floor(Date.now() / 1000);
		const token = await signSessionBearerTokenRaw(
			{
				sub: crypto.randomUUID(),
				wid: crypto.randomUUID(),
				scp: [...SESSION_TOKEN_SCOPES],
				azp: testEnv.USETAGIH_WEB_PUBLIC_URL,
				typ: "session_bearer",
				jti: crypto.randomUUID(),
				iat: now,
				exp: now + 900,
				aud: "https://evil.example/api",
				iss: testEnv.USETAGIH_API_PUBLIC_URL,
			},
			testEnv,
		);

		const response = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(response.status).toBe(401);
	});

	test("JWT with wrong azp → 401", async () => {
		const id = suffix();
		await signUpWithWorkspace(`wrong-azp-${id}`);
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
				aud: testEnv.USETAGIH_API_PUBLIC_URL,
				iss: testEnv.USETAGIH_API_PUBLIC_URL,
			},
			testEnv,
		);

		const response = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(response.status).toBe(401);
	});

	test("CSRF token from different session → 403", async () => {
		const id = suffix();
		const signup = await signUpWithWorkspace(`csrf-cross-${id}`);
		const foreignToken = createCsrfToken(
			testEnv.BETTER_AUTH_SECRET,
			crypto.randomUUID(),
		);

		const response = await fetch(`${base}/v1/session/token`, {
			method: "POST",
			headers: jar.headers({
				[CSRF_HEADER]: foreignToken,
				cookie: `usetagih.csrf=${encodeURIComponent(foreignToken)}; ${jar.headers().cookie ?? ""}`,
			}),
		});

		expect(response.status).toBe(403);
		expect(signup.session.id).toBeDefined();
	});

	test("bearer issued before logout still verifies until exp", async () => {
		const id = suffix();
		await signUpWithWorkspace(`logout-residual-${id}`);

		const accessToken = await exchangeSessionBearer();

		const signOutResponse = await fetch(`${base}/api/auth/sign-out`, {
			method: "POST",
			headers: jar.headers(),
		});
		expect(signOutResponse.status).toBeLessThan(500);

		const verified = await verifySessionBearerToken(accessToken, testEnv);
		expect(verified).not.toBeNull();
	});
});
