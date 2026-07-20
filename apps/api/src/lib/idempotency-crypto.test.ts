import { describe, expect, test } from "bun:test";
import {
	hashIdempotencyKey,
	hashRequestBody,
	validateIdempotencyKeyHeader,
} from "./idempotency-crypto.js";

describe("validateIdempotencyKeyHeader", () => {
	test("accepts printable ASCII keys between 1 and 255 chars", () => {
		const result = validateIdempotencyKeyHeader(" render-key-1 ");
		expect(result).toEqual({ valid: true, key: " render-key-1 " });
	});

	test("rejects missing header", () => {
		expect(validateIdempotencyKeyHeader(null)).toEqual({
			valid: false,
			reason: "missing",
		});
		expect(validateIdempotencyKeyHeader("")).toEqual({
			valid: false,
			reason: "missing",
		});
	});

	test("rejects empty and non-printable keys", () => {
		expect(validateIdempotencyKeyHeader("\n")).toEqual({
			valid: false,
			reason: "invalid",
		});
		expect(validateIdempotencyKeyHeader("a".repeat(256))).toEqual({
			valid: false,
			reason: "invalid",
		});
	});
});

describe("hash helpers", () => {
	test("hashIdempotencyKey returns stable lowercase hex SHA-256", async () => {
		const hash = await hashIdempotencyKey("my-idempotency-key");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(await hashIdempotencyKey("my-idempotency-key")).toBe(hash);
	});

	test("hashRequestBody hashes empty string and preserves byte identity", async () => {
		const empty = await hashRequestBody("");
		expect(empty).toMatch(/^[0-9a-f]{64}$/);

		const bodyA = await hashRequestBody('{"amount":1}');
		const bodyB = await hashRequestBody('{"amount": 1}');
		expect(bodyA).not.toBe(bodyB);
	});
});
