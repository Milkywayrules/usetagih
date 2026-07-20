import { describe, expect, test } from "bun:test";
import { validateUseCase } from "@usetagih/core";
import {
	ApiErrorEnvelopeSchema,
	getHttpStatusForErrorCode,
} from "@usetagih/schema";
import unsupportedSchemaVersion from "../../../../packages/schema/__fixtures__/invalid/schema-version/unsupported-2025-01-01.json";
import invoiceMinimal from "../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import { mapValidateResultToResponse } from "./map-validate-result.js";

function createContext() {
	const set: { status?: number; headers?: Record<string, unknown> } = {};
	return {
		ctx: {
			requestId: "req_test-map-validate",
			set,
			request: new Request("http://localhost/v1/invoices/validate"),
		},
		set,
	};
}

describe("mapValidateResultToResponse", () => {
	test("success returns flat 200 body with normalizedPreview", () => {
		const result = validateUseCase({
			pathDocumentType: "invoice",
			rawPayload: invoiceMinimal,
		});
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error("expected valid result");

		const { ctx } = createContext();
		const body = mapValidateResultToResponse(ctx, result);

		expect(body).toEqual({
			valid: true,
			normalizedPreview: result.normalizedPreview,
		});
		expect(result.normalizedPreview.schemaVersion).toBe("2026-07-20");
	});

	test("VALIDATION_FAILED maps to 422 AD-11 envelope", () => {
		const result = validateUseCase({
			pathDocumentType: "invoice",
			rawPayload: { documentType: "invoice" },
		});
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid result");

		const { ctx, set } = createContext();
		const body = mapValidateResultToResponse(ctx, result);
		const parsed = ApiErrorEnvelopeSchema.parse(body);

		expect(set.status).toBe(getHttpStatusForErrorCode("VALIDATION_FAILED"));
		expect(parsed.error.code).toBe("VALIDATION_FAILED");
		expect(parsed.error.requestId).toBe("req_test-map-validate");
		expect(parsed.error.details.length).toBeGreaterThan(0);
		expect(parsed.error.message).toBe(parsed.error.details[0]?.message);
	});

	test("DOCUMENT_TYPE_MISMATCH maps to 400 AD-11 envelope", () => {
		const result = validateUseCase({
			pathDocumentType: "invoice",
			rawPayload: { ...invoiceMinimal, documentType: "quotation" },
		});
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid result");

		const { ctx, set } = createContext();
		const body = mapValidateResultToResponse(ctx, result);
		const parsed = ApiErrorEnvelopeSchema.parse(body);

		expect(set.status).toBe(
			getHttpStatusForErrorCode("DOCUMENT_TYPE_MISMATCH"),
		);
		expect(parsed.error.code).toBe("DOCUMENT_TYPE_MISMATCH");
		expect(parsed.error.details.some((d) => d.path === "/documentType")).toBe(
			true,
		);
	});

	test("UNSUPPORTED_SCHEMA_VERSION maps to 400 AD-11 envelope", () => {
		const result = validateUseCase({
			pathDocumentType: "invoice",
			rawPayload: unsupportedSchemaVersion,
		});
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid result");

		const { ctx, set } = createContext();
		const body = mapValidateResultToResponse(ctx, result);
		const parsed = ApiErrorEnvelopeSchema.parse(body);

		expect(set.status).toBe(
			getHttpStatusForErrorCode("UNSUPPORTED_SCHEMA_VERSION"),
		);
		expect(parsed.error.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
		expect(parsed.error.details.some((d) => d.path === "/schemaVersion")).toBe(
			true,
		);
	});
});
