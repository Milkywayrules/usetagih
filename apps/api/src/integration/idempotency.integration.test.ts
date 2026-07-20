/**
 * Integration tests for idempotency middleware on render endpoints.
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
import { createDb, probeDb } from "@usetagih/db";
import {
	ApiErrorEnvelopeSchema,
	IDEMPOTENCY_CONFLICT_CODE,
	INVALID_REQUEST_CODE,
} from "@usetagih/schema";
import { createApp } from "../app.js";
import { initTestLogger } from "../test-helpers/evlog.js";

initTestLogger();

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
}

function suffix() {
	return crypto.randomUUID().slice(0, 8);
}

describeIntegration("idempotency integration", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	let stubInvocations = 0;
	const { db, sql } = createDb();
	const jar = new AuthCookieJar();

	beforeAll(() => {
		app = createApp({
			db,
			onRenderStubInvoked: () => {
				stubInvocations += 1;
			},
		});
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
				email: `idempotency-${id}@example.com`,
				password: "password123",
				name: "Idempotency User",
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

	test("missing Idempotency-Key returns 400 INVALID_REQUEST", async () => {
		const id = suffix();
		const apiKey = await signUpAndCreateApiKey(id);

		const response = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ template: "modern" }),
		});

		expect(response.status).toBe(400);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe(INVALID_REQUEST_CODE);
	});

	test("retry with same key and body returns identical renderId without double stub invocation", async () => {
		const id = suffix();
		const apiKey = await signUpAndCreateApiKey(id);
		const idempotencyKey = `render-retry-${id}`;
		const body = JSON.stringify({ template: "modern" });
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"Idempotency-Key": idempotencyKey,
		};

		stubInvocations = 0;

		const first = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers,
			body,
		});
		expect(first.status).toBe(201);
		const firstJson = (await first.json()) as {
			renderId: string;
			shareUrl: string;
			status: string;
			documentType: string;
		};
		expect(firstJson.renderId.startsWith("rnd_")).toBe(true);
		expect(firstJson.status).toBe("completed");
		expect(firstJson.documentType).toBe("invoice");

		const second = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers,
			body,
		});
		expect(second.status).toBe(201);
		expect(await second.json()).toEqual(firstJson);
		expect(stubInvocations).toBe(1);
	});

	test("same key with different body returns 409 IDEMPOTENCY_CONFLICT", async () => {
		const id = suffix();
		const apiKey = await signUpAndCreateApiKey(id);
		const idempotencyKey = `render-conflict-${id}`;
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"Idempotency-Key": idempotencyKey,
		};

		stubInvocations = 0;

		const first = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers,
			body: JSON.stringify({ template: "modern" }),
		});
		expect(first.status).toBe(201);

		const conflict = await fetch(`${base}/v1/invoices/render`, {
			method: "POST",
			headers,
			body: JSON.stringify({ template: "classic" }),
		});
		expect(conflict.status).toBe(409);
		const envelope = ApiErrorEnvelopeSchema.parse(await conflict.json());
		expect(envelope.error.code).toBe(IDEMPOTENCY_CONFLICT_CODE);
		expect(envelope.error.details).toEqual([]);
		expect(stubInvocations).toBe(1);
	});
});
