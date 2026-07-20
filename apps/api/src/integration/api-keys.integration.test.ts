/**
 * Integration tests for API key create, list, revoke, and bearer auth.
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
import { createDb, probeDb, schema } from "@usetagih/db";
import { API_SCOPES } from "@usetagih/schema";
import { and, desc, eq } from "drizzle-orm";
import { createApp } from "../app.js";

const postgresUp = await probeDb();
if (postgresUp) setDefaultTimeout(15_000);
const describeIntegration = postgresUp ? describe : describe.skip;

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

	clear() {
		this.cookies.clear();
	}
}

function suffix() {
	return crypto.randomUUID().slice(0, 8);
}

describeIntegration("api keys integration", () => {
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
				email: `apikey-${id}@example.com`,
				password: "password123",
				name: "Api Key User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-${id}`,
			}),
		});
		jar.absorb(response);
		expect(response.status).toBe(200);
		return response.json() as Promise<{
			workspaceId: string;
			user: { id: string };
		}>;
	}

	test("sign-up → create → list (no secret) → stub auth → revoke → 401", async () => {
		const id = suffix();
		const signup = await signUpWithWorkspace(id);

		const createResponse = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "CI production",
				scopes: ["renders:read", "renders:write"],
			}),
		});
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as {
			id: string;
			secret: string;
			prefix: string;
		};
		expect(created.secret.startsWith("utk_live_")).toBe(true);
		expect(created.prefix).toBe(created.secret.slice(0, 16));

		const [dbRow] = await db
			.select()
			.from(schema.apiKeys)
			.where(eq(schema.apiKeys.prefix, created.prefix));
		expect(dbRow?.keyHash).not.toBe(created.secret);
		expect(dbRow?.keyHash.includes(created.secret)).toBe(false);

		const listResponse = await fetch(`${base}/v1/api-keys`, {
			headers: jar.headers(),
		});
		expect(listResponse.status).toBe(200);
		const listed = (await listResponse.json()) as {
			keys: Array<{ id: string; prefix: string; secret?: string }>;
		};
		expect(listed.keys.some((k) => k.id === created.id)).toBe(true);
		expect(listed.keys.every((k) => k.secret === undefined)).toBe(true);

		const stubResponse = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${created.secret}` },
		});
		expect(stubResponse.status).toBe(501);

		const revokeResponse = await fetch(`${base}/v1/api-keys/${created.id}`, {
			method: "DELETE",
			headers: jar.headers(),
		});
		expect(revokeResponse.status).toBe(200);

		const afterRevoke = await fetch(`${base}/v1/renders`, {
			headers: { Authorization: `Bearer ${created.secret}` },
		});
		expect(afterRevoke.status).toBe(401);

		const auditRows = await db
			.select()
			.from(schema.auditEvents)
			.where(
				and(
					eq(schema.auditEvents.workspaceId, signup.workspaceId),
					eq(schema.auditEvents.resourceType, "api_key"),
				),
			)
			.orderBy(desc(schema.auditEvents.createdAt));

		const actions = auditRows.map((row) => row.action);
		expect(actions).toContain("api_key.created");
		expect(actions).toContain("api_key.revoked");
	});

	test("API key bearer rejected on POST /v1/api-keys", async () => {
		const id = suffix();
		await signUpWithWorkspace(`mgmt-${id}`);

		const createResponse = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "Self issue attempt",
				scopes: [...API_SCOPES],
			}),
		});
		expect(createResponse.status).toBe(201);
		const { secret } = (await createResponse.json()) as { secret: string };

		const blocked = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${secret}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Nested key",
				scopes: ["audit:read"],
			}),
		});
		expect(blocked.status).toBe(403);
		const body = await blocked.json();
		expect(body.error.code).toBe("FORBIDDEN");
	});

	test("DELETE cross-workspace keyId → 404 NOT_FOUND", async () => {
		const idA = suffix();
		const idB = suffix();
		await signUpWithWorkspace(`cross-a-${idA}`);
		const createA = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({ name: "A", scopes: ["audit:read"] }),
		});
		const keyA = (await createA.json()) as { id: string };

		jar.clear();
		await signUpWithWorkspace(`cross-b-${idB}`);

		const crossDelete = await fetch(`${base}/v1/api-keys/${keyA.id}`, {
			method: "DELETE",
			headers: jar.headers(),
		});
		expect(crossDelete.status).toBe(404);
		const body = await crossDelete.json();
		expect(body.error.code).toBe("NOT_FOUND");
	});
});
