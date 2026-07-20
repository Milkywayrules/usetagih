import type { DocumentPayload } from "../document/document-payload";
import { DocumentPayloadSchema } from "../document/document-payload";
import type { UnsupportedSchemaVersionResult } from "../version/assert-schema-version";
import { normalizePayloadSchemaVersion } from "../version/assert-schema-version";
import type { z } from "../zod.js";
import type { BusinessRuleFinding } from "./finding";
import { validateDocumentPayloadArithmetic } from "./validate-arithmetic";

export type ValidateDocumentPayloadResult =
	| { ok: true; data: DocumentPayload }
	| {
			ok: false;
			stage: "schemaVersion";
			rejection: UnsupportedSchemaVersionResult;
	  }
	| { ok: false; stage: "structural"; error: z.ZodError }
	| { ok: false; stage: "business"; findings: BusinessRuleFinding[] };

export function validateDocumentPayload(
	raw: unknown,
): ValidateDocumentPayloadResult {
	const versionResult = normalizePayloadSchemaVersion(raw);
	if (!versionResult.ok) {
		return {
			ok: false,
			stage: "schemaVersion",
			rejection: versionResult,
		};
	}

	const parsed = DocumentPayloadSchema.safeParse(versionResult.normalized);
	if (!parsed.success) {
		return { ok: false, stage: "structural", error: parsed.error };
	}

	const findings = validateDocumentPayloadArithmetic(parsed.data);
	if (findings.length > 0) {
		return { ok: false, stage: "business", findings };
	}

	return { ok: true, data: parsed.data };
}
