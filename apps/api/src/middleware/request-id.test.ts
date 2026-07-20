import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import {
	createRequestId,
	createRequestIdPlugin,
	REQUEST_ID_HEADER,
	REQUEST_ID_PATTERN,
	resolveRequestId,
} from "./request-id.js";

describe("request-id", () => {
	test("createRequestId uses req_ prefix and UUID shape", () => {
		const id = createRequestId();
		expect(id.startsWith("req_")).toBe(true);
		expect(REQUEST_ID_PATTERN.test(id)).toBe(true);
	});

	test("resolveRequestId reuses valid inbound header", () => {
		const inbound = createRequestId();
		expect(resolveRequestId(inbound)).toBe(inbound);
	});

	test("resolveRequestId rejects malformed inbound values", () => {
		const generated = resolveRequestId("not-a-valid-id");
		expect(REQUEST_ID_PATTERN.test(generated)).toBe(true);
		expect(generated).not.toBe("not-a-valid-id");

		const missing = resolveRequestId(null);
		expect(REQUEST_ID_PATTERN.test(missing)).toBe(true);
	});

	test("plugin sets X-Request-Id on responses", async () => {
		const app = new Elysia()
			.use(createRequestIdPlugin())
			.get("/ping", ({ requestId }) => ({ requestId }));

		const response = await app.handle(new Request("http://localhost/ping"));
		const header = response.headers.get(REQUEST_ID_HEADER);
		expect(header).toBeTruthy();
		if (!header) throw new Error("expected X-Request-Id header");
		expect(REQUEST_ID_PATTERN.test(header)).toBe(true);

		const body = (await response.json()) as { requestId: string };
		expect(body.requestId).toBe(header);
	});

	test("plugin propagates valid inbound X-Request-Id", async () => {
		const inbound = createRequestId();
		const app = new Elysia()
			.use(createRequestIdPlugin())
			.get("/ping", ({ requestId }) => ({ requestId }));

		const response = await app.handle(
			new Request("http://localhost/ping", {
				headers: { [REQUEST_ID_HEADER]: inbound },
			}),
		);
		expect(response.headers.get(REQUEST_ID_HEADER)).toBe(inbound);
		const body = (await response.json()) as { requestId: string };
		expect(body.requestId).toBe(inbound);
	});
});
