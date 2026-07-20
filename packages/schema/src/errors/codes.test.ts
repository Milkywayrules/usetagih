import { expect, test } from "bun:test";
import {
	DOCUMENT_TYPE_MISMATCH_CODE,
	ERROR_CODES,
	FORBIDDEN_CODE,
	IDEMPOTENCY_CONFLICT_CODE,
	INTERNAL_ERROR_CODE,
	INVALID_REQUEST_CODE,
	LINE_TOTAL_MISMATCH_CODE,
	NOT_FOUND_CODE,
	QUOTA_EXCEEDED_CODE,
	RATE_LIMITED_CODE,
	TAX_TOTAL_MISMATCH_CODE,
	UNAUTHORIZED_CODE,
	UNSUPPORTED_SCHEMA_VERSION_CODE,
	VALIDATION_FAILED_CODE,
	WORKSPACE_REQUIRED_CODE,
} from "./codes";
import { getHttpStatusForErrorCode } from "./http-status";

const EXPECTED_HTTP_STATUS: Record<(typeof ERROR_CODES)[number], number> = {
	DOCUMENT_TYPE_MISMATCH: 400,
	FORBIDDEN: 403,
	IDEMPOTENCY_CONFLICT: 409,
	INTERNAL_ERROR: 500,
	INVALID_REQUEST: 400,
	LINE_TOTAL_MISMATCH: 422,
	NOT_FOUND: 404,
	QUOTA_EXCEEDED: 402,
	RATE_LIMITED: 429,
	TAX_TOTAL_MISMATCH: 422,
	UNAUTHORIZED: 401,
	UNSUPPORTED_SCHEMA_VERSION: 400,
	VALIDATION_FAILED: 422,
	WORKSPACE_REQUIRED: 403,
};

const CODE_CONSTANTS = {
	DOCUMENT_TYPE_MISMATCH_CODE,
	FORBIDDEN_CODE,
	IDEMPOTENCY_CONFLICT_CODE,
	INTERNAL_ERROR_CODE,
	INVALID_REQUEST_CODE,
	LINE_TOTAL_MISMATCH_CODE,
	NOT_FOUND_CODE,
	QUOTA_EXCEEDED_CODE,
	RATE_LIMITED_CODE,
	TAX_TOTAL_MISMATCH_CODE,
	UNAUTHORIZED_CODE,
	UNSUPPORTED_SCHEMA_VERSION_CODE,
	VALIDATION_FAILED_CODE,
	WORKSPACE_REQUIRED_CODE,
} as const;

test("ERROR_CODES contains exactly 14 PRD codes", () => {
	expect(ERROR_CODES).toHaveLength(14);
	expect(new Set(ERROR_CODES).size).toBe(14);
});

test("every code constant matches its ERROR_CODES entry", () => {
	for (const code of ERROR_CODES) {
		expect(typeof code).toBe("string");
		expect(ERROR_CODES).toContain(code);
	}

	for (const constant of Object.values(CODE_CONSTANTS)) {
		expect(ERROR_CODES).toContain(constant);
		expect(constant).toBe(constant);
	}
});

test("every code maps to exactly one HTTP status", () => {
	for (const code of ERROR_CODES) {
		expect(getHttpStatusForErrorCode(code)).toBe(EXPECTED_HTTP_STATUS[code]);
	}
});

test("402 and 429 status codes are exclusive to QUOTA_EXCEEDED and RATE_LIMITED", () => {
	expect(getHttpStatusForErrorCode("QUOTA_EXCEEDED")).toBe(402);
	expect(getHttpStatusForErrorCode("RATE_LIMITED")).toBe(429);
	expect(
		ERROR_CODES.filter((code) => getHttpStatusForErrorCode(code) === 402),
	).toEqual(["QUOTA_EXCEEDED"]);
	expect(
		ERROR_CODES.filter((code) => getHttpStatusForErrorCode(code) === 429),
	).toEqual(["RATE_LIMITED"]);
});

test("WORKSPACE_REQUIRED maps to 403", () => {
	expect(getHttpStatusForErrorCode("WORKSPACE_REQUIRED")).toBe(403);
	expect(WORKSPACE_REQUIRED_CODE).toBe("WORKSPACE_REQUIRED");
});
