/**
 * Integration tests for better-auth registration, login, and session middleware.
 * Skipped when compose Postgres is unreachable (probeDb false).
 */
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	setDefaultTimeout,
	test,
} from "bun:test";
import { auth, createDb, probeDb, schema } from "@usetagih/db";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { createApp } from "../app.js";
import { createRequestIdPlugin } from "../middleware/request-id.js";
import { createV1ErrorHandler } from "../middleware/v1-error-handler.js";
import { initTestLogger } from "../test-helpers/evlog.js";

const postgresUp = await probeDb();
if (postgresUp) setDefaultTimeout(15_000);
const describeIntegration = postgresUp ? describe : describe.skip;

initTestLogger();

function suffix() {
	return crypto.randomUUID().slice(0, 8);
}

function extractCookies(response: Response): string {
	const cookies = response.headers.getSetCookie();
	return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function signUpWithWorkspace(
	base: string,
	opts: {
		email: string;
		password: string;
		name: string;
		workspaceName: string;
		workspaceSlug: string;
		cookie?: string;
	},
) {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (opts.cookie) {
		headers.cookie = opts.cookie;
	}

	return fetch(`${base}/api/auth/sign-up-with-workspace`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			email: opts.email,
			password: opts.password,
			name: opts.name,
			workspaceName: opts.workspaceName,
			workspaceSlug: opts.workspaceSlug,
		}),
	});
}

describeIntegration("auth integration", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	let port: number;
	const { db, sql } = createDb();

	beforeAll(() => {
		app = createApp({ db });
		app.listen(0);
		port = app.server?.port ?? 0;
		base = `http://127.0.0.1:${port}`;
	});

	afterAll(async () => {
		app.stop();
		await sql.end({ timeout: 1 });
	});

	test("sign-up-with-workspace creates user, org, workspace_settings, activeOrganizationId", async () => {
		const id = suffix();
		const response = await signUpWithWorkspace(base, {
			email: `signup-${id}@example.com`,
			password: "password123",
			name: "Test User",
			workspaceName: `Workspace ${id}`,
			workspaceSlug: `ws-${id}`,
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			workspaceId: string;
			session: { activeOrganizationId?: string };
		};
		expect(body.workspaceId).toBeDefined();
		expect(body.session.activeOrganizationId).toBe(body.workspaceId);

		const [settings] = await db
			.select()
			.from(schema.workspaceSettings)
			.where(eq(schema.workspaceSettings.organizationId, body.workspaceId))
			.limit(1);
		expect(settings?.tier).toBe("trial");
	});

	test("GET /v1/renders unauthenticated → 401", async () => {
		const response = await fetch(`${base}/v1/renders`);
		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error.code).toBe("UNAUTHORIZED");
		const requestId = response.headers.get("X-Request-Id");
		expect(requestId).toBeTruthy();
		expect(body.error.requestId).toBe(requestId);
		expect(Array.isArray(body.error.details)).toBe(true);
	});

	test("GET /v1/renders authenticated without active org → 403 WORKSPACE_REQUIRED", async () => {
		const id = suffix();
		const email = `no-org-${id}@example.com`;
		const password = "password123";

		const signUpResponse = await fetch(`${base}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, name: "No Org User" }),
		});
		expect(signUpResponse.status).toBe(200);
		const cookie = extractCookies(signUpResponse);

		const response = await fetch(`${base}/v1/renders`, {
			headers: { cookie },
		});
		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error.code).toBe("WORKSPACE_REQUIRED");
	});

	test("GET /v1/renders authenticated with active org → 200 empty list", async () => {
		const id = suffix();
		const signUpResponse = await signUpWithWorkspace(base, {
			email: `active-${id}@example.com`,
			password: "password123",
			name: "Active Org User",
			workspaceName: `Active WS ${id}`,
			workspaceSlug: `active-${id}`,
		});
		expect(signUpResponse.status).toBe(200);
		const cookie = extractCookies(signUpResponse);

		const response = await fetch(`${base}/v1/renders`, {
			headers: { cookie },
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			renders: unknown[];
			total: number;
		};
		expect(Array.isArray(body.renders)).toBe(true);
		expect(body.total).toBeGreaterThanOrEqual(0);
	});

	test("GET /v1/unknown-route-xyz → 404 NOT_FOUND envelope", async () => {
		const response = await fetch(`${base}/v1/unknown-route-xyz`);
		expect(response.status).toBe(404);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("NOT_FOUND");
		expect(body.error.message).toBe("Route not found");
		expect(body.error.details).toEqual([]);
		const requestIdHeader = response.headers.get("X-Request-Id");
		expect(requestIdHeader).not.toBeNull();
		if (!requestIdHeader) throw new Error("expected X-Request-Id header");
		expect(body.error.requestId).toBe(requestIdHeader);
	});

	test("unhandled /v1 error → 500 INTERNAL_ERROR without stack leakage", async () => {
		const throwApp = new Elysia().group("/v1", (group) =>
			group
				.use(createRequestIdPlugin())
				.use(createV1ErrorHandler())
				.get("/__test/throw", () => {
					throw new Error("secret internal stack trace detail");
				}),
		);
		throwApp.listen(0);
		const throwPort = throwApp.server?.port ?? 0;
		const throwBase = `http://127.0.0.1:${throwPort}`;

		try {
			const response = await fetch(`${throwBase}/v1/__test/throw`);
			expect(response.status).toBe(500);
			const text = await response.text();
			expect(text).not.toContain("stack");
			expect(text).not.toContain("secret internal");
			const body = ApiErrorEnvelopeSchema.parse(JSON.parse(text));
			expect(body.error.code).toBe("INTERNAL_ERROR");
			expect(body.error.message).toBe("An internal error occurred");
			expect(body.error.requestId).toMatch(/^req_/);
		} finally {
			throwApp.stop();
		}
	});

	test("failed sign-in does not append login audit row", async () => {
		const id = suffix();
		const email = `failed-login-${id}@example.com`;
		const password = "password123";

		const signUpResponse = await signUpWithWorkspace(base, {
			email,
			password,
			name: "Failed Login User",
			workspaceName: `Failed WS ${id}`,
			workspaceSlug: `failed-${id}`,
		});
		expect(signUpResponse.status).toBe(200);
		const signUpBody = (await signUpResponse.json()) as {
			user: { id: string };
		};
		const userId = signUpBody.user.id;

		const beforeCount = (
			await db
				.select()
				.from(schema.auditEvents)
				.where(eq(schema.auditEvents.userId, userId))
		).filter((row) => row.action === "login").length;

		const loginResponse = await fetch(`${base}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: "wrong-password" }),
		});
		expect(loginResponse.status).toBeGreaterThanOrEqual(400);

		const afterCount = (
			await db
				.select()
				.from(schema.auditEvents)
				.where(eq(schema.auditEvents.userId, userId))
		).filter((row) => row.action === "login").length;
		expect(afterCount).toBe(beforeCount);
	});

	test("sign-in appends login audit row", async () => {
		const id = suffix();
		const email = `login-audit-${id}@example.com`;
		const password = "password123";

		const signUpResponse = await signUpWithWorkspace(base, {
			email,
			password,
			name: "Login Audit User",
			workspaceName: `Login WS ${id}`,
			workspaceSlug: `login-${id}`,
		});
		expect(signUpResponse.status).toBe(200);
		const signUpBody = (await signUpResponse.json()) as {
			user: { id: string };
		};
		const userId = signUpBody.user.id;

		await fetch(`${base}/api/auth/sign-out`, {
			method: "POST",
			headers: { cookie: extractCookies(signUpResponse) },
		});

		const loginResponse = await fetch(`${base}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		expect(loginResponse.status).toBe(200);

		const loginAudits = await db
			.select()
			.from(schema.auditEvents)
			.where(eq(schema.auditEvents.userId, userId));
		const loginRow = loginAudits.find((row) => row.action === "login");
		expect(loginRow).toBeDefined();
		expect(loginRow?.workspaceId).toBeNull();
		expect(loginRow?.outcome).toBe("success");
	});

	test("tenant isolation: cannot set-active to another user's org", async () => {
		const id = suffix();
		const victimResponse = await signUpWithWorkspace(base, {
			email: `victim-${id}@example.com`,
			password: "password123",
			name: "Victim User",
			workspaceName: `Victim WS ${id}`,
			workspaceSlug: `victim-${id}`,
		});
		expect(victimResponse.status).toBe(200);
		const victimBody = (await victimResponse.json()) as { workspaceId: string };

		const attackerResponse = await signUpWithWorkspace(base, {
			email: `attacker-${id}@example.com`,
			password: "password123",
			name: "Attacker User",
			workspaceName: `Attacker WS ${id}`,
			workspaceSlug: `attacker-${id}`,
		});
		expect(attackerResponse.status).toBe(200);
		const attackerCookie = extractCookies(attackerResponse);

		const hijackResponse = await fetch(
			`${base}/api/auth/organization/set-active`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: attackerCookie,
				},
				body: JSON.stringify({ organizationId: victimBody.workspaceId }),
			},
		);
		expect(hijackResponse.status).toBeGreaterThanOrEqual(400);
		expect(hijackResponse.status).toBeLessThan(500);

		// better-auth clears activeOrganizationId when set-active membership check fails
		const rendersResponse = await fetch(`${base}/v1/renders`, {
			headers: { cookie: attackerCookie },
		});
		expect(rendersResponse.status).toBe(403);
		const rendersBody = (await rendersResponse.json()) as {
			error: { code: string };
		};
		expect(rendersBody.error.code).toBe("WORKSPACE_REQUIRED");
	});

	test("membershipLimit blocks second member via auth.api.addMember", async () => {
		const id = suffix();
		const ownerResponse = await signUpWithWorkspace(base, {
			email: `limit-owner-${id}@example.com`,
			password: "password123",
			name: "Limit Owner",
			workspaceName: `Limit WS ${id}`,
			workspaceSlug: `limit-${id}`,
		});
		expect(ownerResponse.status).toBe(200);
		const ownerBody = (await ownerResponse.json()) as {
			workspaceId: string;
			user: { id: string };
		};
		const ownerCookie = extractCookies(ownerResponse);

		const secondUser = await auth.api.signUpEmail({
			body: {
				email: `limit-second-${id}@example.com`,
				password: "password123",
				name: "Limit Second",
			},
		});

		await expect(
			auth.api.addMember({
				body: {
					userId: secondUser.user.id,
					role: "member",
					organizationId: ownerBody.workspaceId,
				},
				headers: { cookie: ownerCookie },
			}),
		).rejects.toThrow();

		const members = await db
			.select()
			.from(schema.member)
			.where(eq(schema.member.organizationId, ownerBody.workspaceId));
		expect(members).toHaveLength(1);
	});

	test("second-member rejection matrix", async () => {
		const id = suffix();
		const ownerResponse = await signUpWithWorkspace(base, {
			email: `owner-${id}@example.com`,
			password: "password123",
			name: "Owner User",
			workspaceName: `Owner WS ${id}`,
			workspaceSlug: `owner-${id}`,
		});
		expect(ownerResponse.status).toBe(200);
		const ownerBody = (await ownerResponse.json()) as {
			workspaceId: string;
			user: { id: string };
		};
		const ownerCookie = extractCookies(ownerResponse);
		const organizationId = ownerBody.workspaceId;

		const memberResponse = await signUpWithWorkspace(base, {
			email: `member-${id}@example.com`,
			password: "password123",
			name: "Second User",
			workspaceName: `Member WS ${id}`,
			workspaceSlug: `member-${id}`,
		});
		expect(memberResponse.status).toBe(200);
		const memberBody = (await memberResponse.json()) as {
			user: { id: string };
		};
		const secondUserId = memberBody.user.id;

		const ownerHeaders = {
			"Content-Type": "application/json",
			cookie: ownerCookie,
		};

		const matrix: Array<{ path: string; body: Record<string, unknown> }> = [
			{
				path: "/organization/invite-member",
				body: {
					email: "second@example.com",
					role: "member",
					organizationId,
				},
			},
			{
				path: "/organization/accept-invitation",
				body: { invitationId: crypto.randomUUID() },
			},
			{
				path: "/organization/remove-member",
				body: { memberId: crypto.randomUUID(), organizationId },
			},
		];

		for (const case_ of matrix) {
			const response = await fetch(`${base}/api/auth${case_.path}`, {
				method: "POST",
				headers: ownerHeaders,
				body: JSON.stringify(case_.body),
			});
			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(500);
		}

		await expect(
			auth.api.addMember({
				body: {
					userId: secondUserId,
					role: "member",
					organizationId,
				},
				headers: { cookie: ownerCookie },
			}),
		).rejects.toThrow();

		const members = await db
			.select()
			.from(schema.member)
			.where(eq(schema.member.organizationId, organizationId));
		expect(members).toHaveLength(1);
	});

	test("password reset route reachable", async () => {
		const response = await fetch(`${base}/api/auth/request-password-reset`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "reset@example.com" }),
		});
		expect(response.status).toBe(200);
	});
});
