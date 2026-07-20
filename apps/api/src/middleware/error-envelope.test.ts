import { describe, expect, test } from "bun:test";
import {
	ApiErrorEnvelopeSchema,
	getHttpStatusForErrorCode,
	NOT_FOUND_CODE,
	VALIDATION_FAILED_CODE,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../lib/api-error.js";
import { createRequestIdPlugin, resolveRequestId } from "./request-id.js";
import { createV1ErrorHandler } from "./v1-error-handler.js";

describe("request-id middleware", () => {
	test("resolveRequestId generates req_ prefix for missing inbound", () => {
		const requestId = resolveRequestId(null);
		expect(requestId.startsWith("req_")).toBe(true);
		expect(requestId).toMatch(
			/^req_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
	});

	test("resolveRequestId reuses valid inbound header", () => {
		const inbound = "req_550e8400-e29b-41d4-a716-446655440000";
		expect(resolveRequestId(inbound)).toBe(inbound);
	});

	test("resolveRequestId rejects malformed inbound", () => {
		const generated = resolveRequestId("not-a-valid-request-id");
		expect(generated.startsWith("req_")).toBe(true);
		expect(generated).not.toBe("not-a-valid-request-id");
	});

	test("plugin sets X-Request-Id on success responses", async () => {
		const app = new Elysia()
			.use(createRequestIdPlugin())
			.get("/ping", ({ requestId }) => ({ requestId }));

		const response = await app.handle(new Request("http://localhost/ping"));
		expect(response.status).toBe(200);
		const header = response.headers.get("X-Request-Id");
		expect(header).toBeTruthy();
		expect(header?.startsWith("req_")).toBe(true);
	});
});

describe("respondApiError", () => {
	test("returns envelope parseable by ApiErrorEnvelopeSchema", () => {
		const set = { status: 200 };
		const envelope = respondApiError({
			set,
			code: NOT_FOUND_CODE,
			message: "Resource not found",
			requestId: "req_test",
		});

		expect(ApiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
		expect(set.status).toBe(getHttpStatusForErrorCode(NOT_FOUND_CODE));
	});

	test("validation mapping produces non-empty details for invalid body", () => {
		const set = { status: 200 };
		const envelope = respondApiError({
			set,
			code: VALIDATION_FAILED_CODE,
			message: "Request validation failed",
			requestId: "req_test",
			details: [
				{
					path: "/name",
					code: VALIDATION_FAILED_CODE,
					message: "String must contain at least 1 character(s)",
				},
			],
		});

		expect(set.status).toBe(422);
		expect(envelope.error.details.length).toBeGreaterThan(0);
		expect(ApiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
	});

	test("v1 error handler returns 404 envelope for unknown routes", async () => {
		const app = new Elysia()
			.use(createRequestIdPlugin())
			.group("/v1", (group) => group.use(createV1ErrorHandler()));

		const response = await app.handle(
			new Request("http://localhost/v1/does-not-exist"),
		);
		expect(response.status).toBe(404);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("NOT_FOUND");
		const requestIdHeader = response.headers.get("X-Request-Id");
		expect(requestIdHeader).not.toBeNull();
		if (!requestIdHeader) throw new Error("expected X-Request-Id header");
		expect(body.error.requestId).toBe(requestIdHeader);
	});

	test("v1 error handler masks internal errors without stack leakage", async () => {
		const app = new Elysia()
			.use(createRequestIdPlugin())
			.group("/v1", (group) =>
				group
					.get("/boom", () => {
						throw new Error("super secret stack material");
					})
					.use(createV1ErrorHandler()),
			);

		const response = await app.handle(new Request("http://localhost/v1/boom"));
		expect(response.status).toBe(500);
		const raw = await response.text();
		expect(raw.toLowerCase()).not.toContain("stack");
		expect(raw).not.toContain("super secret stack material");

		const body = ApiErrorEnvelopeSchema.parse(JSON.parse(raw));
		expect(body.error.code).toBe("INTERNAL_ERROR");
		expect(body.error.message).toBe("An internal error occurred");
	});
});
