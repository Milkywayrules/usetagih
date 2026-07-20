import type { DocumentPayload, DocumentType } from "@usetagih/schema";
import {
	type ApiErrorDetail,
	businessFindingToDetail,
	checkDocumentTypeMismatch,
	type ErrorCode,
	validateDocumentPayload,
	zodIssuesToDetails,
} from "@usetagih/schema";

export type ValidateUseCaseInput = {
	pathDocumentType: DocumentType;
	rawPayload: unknown;
};

export type ValidateUseCaseSuccess = {
	valid: true;
	normalizedPreview: DocumentPayload;
};

export type ValidateUseCaseFailure = {
	valid: false;
	code: ErrorCode;
	details: ApiErrorDetail[];
};

export type ValidateUseCaseResult =
	| ValidateUseCaseSuccess
	| ValidateUseCaseFailure;

export function mapValidateFailureToDetails(
	result: Exclude<ReturnType<typeof validateDocumentPayload>, { ok: true }>,
): ApiErrorDetail[] {
	if (result.stage === "schemaVersion") {
		return [
			{
				path: "/schemaVersion",
				code: result.rejection.code,
				message: result.rejection.message,
			},
		];
	}

	if (result.stage === "structural") {
		return zodIssuesToDetails(result.error);
	}

	return result.findings.map(businessFindingToDetail);
}

export function validateUseCase(
	input: ValidateUseCaseInput,
): ValidateUseCaseResult {
	const { pathDocumentType, rawPayload } = input;

	if (typeof rawPayload !== "object" || rawPayload === null) {
		return {
			valid: false,
			code: "VALIDATION_FAILED",
			details: [
				{
					path: "/",
					code: "VALIDATION_FAILED",
					message: "payload must be a JSON object",
				},
			],
		};
	}

	const mismatch = checkDocumentTypeMismatch(pathDocumentType, rawPayload);
	if (!mismatch.match) {
		return {
			valid: false,
			code: "DOCUMENT_TYPE_MISMATCH",
			details: [
				{
					path: "/documentType",
					code: "DOCUMENT_TYPE_MISMATCH",
					message: mismatch.message,
				},
			],
		};
	}

	const result = validateDocumentPayload(rawPayload);
	if (result.ok) {
		return { valid: true, normalizedPreview: result.data };
	}

	const details = mapValidateFailureToDetails(result);
	const code: ErrorCode =
		result.stage === "schemaVersion"
			? result.rejection.code
			: "VALIDATION_FAILED";

	return { valid: false, code, details };
}
