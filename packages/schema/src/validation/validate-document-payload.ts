import type { z } from "zod";
import type { DocumentPayload } from "../document/document-payload";
import { DocumentPayloadSchema } from "../document/document-payload";
import type { BusinessRuleFinding } from "./finding";
import { validateDocumentPayloadArithmetic } from "./validate-arithmetic";

export type ValidateDocumentPayloadResult =
	| { ok: true; data: DocumentPayload }
	| { ok: false; stage: "structural"; error: z.ZodError }
	| { ok: false; stage: "business"; findings: BusinessRuleFinding[] };

export function validateDocumentPayload(
	raw: unknown,
): ValidateDocumentPayloadResult {
	const parsed = DocumentPayloadSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, stage: "structural", error: parsed.error };
	}

	const findings = validateDocumentPayloadArithmetic(parsed.data);
	if (findings.length > 0) {
		return { ok: false, stage: "business", findings };
	}

	return { ok: true, data: parsed.data };
}
