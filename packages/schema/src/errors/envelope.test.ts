import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentPayloadSchema } from "../document/document-payload";
import { TAX_TOTAL_MISMATCH_CODE } from "../validation/codes";
import { validateDocumentPayload } from "../validation/validate-document-payload";
import { businessFindingToDetail } from "./detail";
import { ApiErrorEnvelopeSchema, buildApiErrorEnvelope } from "./envelope";
import { getHttpStatusForErrorCode } from "./http-status";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "../..");

function loadJson(relativePath: string): unknown {
	const absolutePath = join(packageRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

test("buildApiErrorEnvelope defaults details to empty array", () => {
	const envelope = buildApiErrorEnvelope({
		code: "NOT_FOUND",
		message: "Resource not found",
		requestId: "req_test",
	});

	expect(envelope.error.details).toEqual([]);
	expect(ApiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
});

test("PRD §10.3 example round-trips through ApiErrorEnvelopeSchema", () => {
	const prdExample = buildApiErrorEnvelope({
		code: "VALIDATION_FAILED",
		message: "Payload failed schema validation",
		requestId: "req_01H...",
		details: [
			{
				path: "/totals/grandTotal",
				code: "TAX_TOTAL_MISMATCH",
				message: "taxTotal 110.00 does not match sum of taxLines 108.90",
				expected: "108.90",
				received: "110.00",
			},
		],
	});

	expect(ApiErrorEnvelopeSchema.parse(prdExample)).toEqual(prdExample);
});

test("businessFindingToDetail preserves path, code, message, expected, and received", () => {
	const detail = businessFindingToDetail({
		path: "/totals/taxTotal",
		code: TAX_TOTAL_MISMATCH_CODE,
		message: "tax total mismatch",
		expected: "108.90",
		received: "110.00",
	});

	expect(detail).toEqual({
		path: "/totals/taxTotal",
		code: "TAX_TOTAL_MISMATCH",
		message: "tax total mismatch",
		expected: "108.90",
		received: "110.00",
	});
});

test("tax-total-mismatch fixture maps to TAX_TOTAL_MISMATCH detail with HTTP 422", () => {
	const raw = loadJson(
		"__fixtures__/invalid/arithmetic/tax-total-mismatch.json",
	);
	const result = validateDocumentPayload(raw);
	expect(result.ok).toBe(false);
	if (result.ok || result.stage !== "business") {
		throw new Error("expected business validation failure");
	}

	const details = result.findings.map(businessFindingToDetail);
	const taxDetail = details.find(
		(detail) => detail.path === "/totals/taxTotal",
	);
	expect(taxDetail).toBeDefined();
	expect(taxDetail?.code).toBe(TAX_TOTAL_MISMATCH_CODE);
	expect(getHttpStatusForErrorCode(TAX_TOTAL_MISMATCH_CODE)).toBe(422);

	const envelope = buildApiErrorEnvelope({
		code: "VALIDATION_FAILED",
		message: "Payload failed validation",
		requestId: "req_fixture",
		details,
	});
	expect(ApiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
	expect(DocumentPayloadSchema.safeParse(raw).success).toBe(true);
});
