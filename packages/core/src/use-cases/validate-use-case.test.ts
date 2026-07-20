import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	DocumentPayloadSchema,
	type DocumentType,
	discoverFixturePairs,
	normalizePayloadSchemaVersion,
} from "@usetagih/schema";
import { validateUseCase } from "./validate-use-case.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturesRoot = join(packageRoot, "../schema/__fixtures__");

const pairs = discoverFixturePairs(fixturesRoot);

test("fixture corpus has 3 valid and at least 20 failure entries", () => {
	const passEntries = pairs.filter((pair) => pair.expected.outcome === "pass");
	const failEntries = pairs.filter((pair) => pair.expected.outcome === "fail");

	expect(passEntries.length).toBe(3);
	expect(failEntries.length).toBeGreaterThanOrEqual(20);
	expect(failEntries.length).toBe(22);
});

test("validateUseCase matches declared pass/fail outcomes for all sidecar pairs", () => {
	for (const pair of pairs) {
		const { expected, payload } = pair;

		if (expected.outcome === "pass") {
			const docType = (payload as { documentType: DocumentType }).documentType;
			const result = validateUseCase({
				pathDocumentType: docType,
				rawPayload: payload,
			});
			expect(result.valid).toBe(true);
			if (result.valid) {
				const versionResult = normalizePayloadSchemaVersion(payload);
				expect(versionResult.ok).toBe(true);
				if (versionResult.ok) {
					expect(result.normalizedPreview).toEqual(
						DocumentPayloadSchema.parse(versionResult.normalized),
					);
				}
			}
			continue;
		}

		if (expected.stage === "documentTypeMismatch") {
			const result = validateUseCase({
				pathDocumentType: expected.pathDocumentType,
				rawPayload: expected.body,
			});
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.code).toBe("DOCUMENT_TYPE_MISMATCH");
				expect({
					path: result.details[0]?.path,
					code: result.details[0]?.code,
				}).toEqual(expected.expected);
			}
			continue;
		}

		const docType = (payload as { documentType: DocumentType }).documentType;
		const result = validateUseCase({
			pathDocumentType: docType,
			rawPayload: payload,
		});
		expect(result.valid).toBe(false);
		if (result.valid) {
			continue;
		}

		expect(result.code).toBe(
			expected.stage === "schemaVersion"
				? expected.expected.code
				: "VALIDATION_FAILED",
		);
		expect({
			path: result.details[0]?.path,
			code: result.details[0]?.code,
		}).toEqual(expected.expected);
	}
});

test("validateUseCase rejects non-object payload", () => {
	const result = validateUseCase({
		pathDocumentType: "invoice",
		rawPayload: "not-an-object",
	});
	expect(result).toEqual({
		valid: false,
		code: "VALIDATION_FAILED",
		details: [
			{
				path: "/",
				code: "VALIDATION_FAILED",
				message: "payload must be a JSON object",
			},
		],
	});
});
