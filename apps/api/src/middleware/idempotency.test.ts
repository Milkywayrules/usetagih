import { describe, expect, test } from "bun:test";
import type { IdempotencyLookupResult, IdempotencyStore } from "@usetagih/core";
import {
	ApiErrorEnvelopeSchema,
	IDEMPOTENCY_CONFLICT_CODE,
	INVALID_REQUEST_CODE,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import {
	hashIdempotencyKey,
	hashRequestBody,
} from "../lib/idempotency-crypto.js";
import { createIdempotencyMiddleware } from "./idempotency.js";
import { createRequestIdPlugin, REQUEST_ID_HEADER } from "./request-id.js";
import { createSecurityHeadersPlugin } from "./security-headers.js";

class MemoryIdempotencyStore implements IdempotencyStore {
	private readonly rows = new Map<
		string,
		{
			requestHash: string;
			responseBody: unknown;
			expiresAt: Date;
		}
	>();

	private key(workspaceId: string, endpoint: string, keyHash: string) {
		return `${workspaceId}:${endpoint}:${keyHash}`;
	}

	async lookup(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
	}): Promise<IdempotencyLookupResult> {
		const row = this.rows.get(
			this.key(params.workspaceId, params.endpoint, params.keyHash),
		);
		if (!row || row.expiresAt <= new Date()) {
			return { status: "miss" };
		}
		return {
			status: "hit",
			requestHash: row.requestHash,
			responseBody: row.responseBody,
		};
	}

	async store(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
		requestHash: string;
		responseBody: unknown;
		expiresAt: Date;
	}) {
		this.rows.set(
			this.key(params.workspaceId, params.endpoint, params.keyHash),
			{
				requestHash: params.requestHash,
				responseBody: params.responseBody,
				expiresAt: params.expiresAt,
			},
		);
	}
}

function createTestApp(options?: { idempotencyStore?: IdempotencyStore }) {
	let handlerCalls = 0;
	const store = options?.idempotencyStore ?? new MemoryIdempotencyStore();

	const app = new Elysia()
		.use(createRequestIdPlugin())
		.use(createSecurityHeadersPlugin())
		.derive({ as: "scoped" }, () => ({ workspaceId: "ws_test" }))
		.use(
			createIdempotencyMiddleware({
				idempotencyStore: store,
				documentTypePath: "invoices",
				handler: ({ status }) => {
					handlerCalls += 1;
					return status(201, {
						renderId: "rnd_test",
						shareUrl: "https://example.com/share/token",
					});
				},
			}),
		);

	return {
		app,
		getHandlerCalls: () => handlerCalls,
		store,
	};
}

describe("createIdempotencyMiddleware", () => {
	test("returns 400 INVALID_REQUEST when Idempotency-Key header is missing", async () => {
		const { app } = createTestApp();
		const response = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
		);

		expect(response.status).toBe(400);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe(INVALID_REQUEST_CODE);
		expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.error.requestId);
	});

	test("returns 400 INVALID_REQUEST when Idempotency-Key has invalid charset", async () => {
		const { app } = createTestApp();
		const response = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Idempotency-Key": "bad\tkey",
				},
				body: "{}",
			}),
		);

		expect(response.status).toBe(400);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe(INVALID_REQUEST_CODE);
	});

	test("returns cached response on retry without invoking handler twice", async () => {
		const { app, getHandlerCalls } = createTestApp();
		const headers = {
			"Content-Type": "application/json",
			"Idempotency-Key": "retry-key-1",
		};
		const body = JSON.stringify({ template: "modern" });

		const first = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers,
				body,
			}),
		);
		expect(first.status).toBe(201);
		const firstJson = await first.json();

		const second = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers,
				body,
			}),
		);
		expect(second.status).toBe(201);
		expect(await second.json()).toEqual(firstJson);
		expect(getHandlerCalls()).toBe(1);
	});

	test("returns 409 IDEMPOTENCY_CONFLICT when body differs for same key", async () => {
		const { app, getHandlerCalls } = createTestApp();
		const headers = {
			"Content-Type": "application/json",
			"Idempotency-Key": "conflict-key-1",
		};

		const first = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers,
				body: JSON.stringify({ template: "modern" }),
			}),
		);
		expect(first.status).toBe(201);

		const conflict = await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers,
				body: JSON.stringify({ template: "classic" }),
			}),
		);
		expect(conflict.status).toBe(409);
		const envelope = ApiErrorEnvelopeSchema.parse(await conflict.json());
		expect(envelope.error.code).toBe(IDEMPOTENCY_CONFLICT_CODE);
		expect(envelope.error.details).toEqual([]);
		expect(conflict.headers.get(REQUEST_ID_HEADER)).toBe(
			envelope.error.requestId,
		);
		expect(getHandlerCalls()).toBe(1);
	});

	test("hashes raw request bytes for conflict detection", async () => {
		const store = new MemoryIdempotencyStore();
		const { app } = createTestApp({ idempotencyStore: store });
		const headers = {
			"Content-Type": "application/json",
			"Idempotency-Key": "raw-body-key",
		};

		await app.handle(
			new Request("http://localhost/invoices/render", {
				method: "POST",
				headers,
				body: '{"amount":1}',
			}),
		);

		const requestHash = await hashRequestBody('{"amount":1}');
		const lookup = await store.lookup({
			workspaceId: "ws_test",
			endpoint: "POST /v1/invoices/render",
			keyHash: await hashIdempotencyKey("raw-body-key"),
		});
		expect(lookup.status).toBe("hit");
		if (lookup.status === "hit") {
			expect(lookup.requestHash).toBe(requestHash);
		}
	});
});
