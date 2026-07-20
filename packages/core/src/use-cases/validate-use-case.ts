import type { DocumentPayload, DocumentType } from "@usetagih/schema";
import {
	type ApiErrorDetail,
	businessFindingToDetail,
	checkDocumentTypeMismatch,
	type ErrorCode,
	validateDocumentPayload,
} from "@usetagih/schema";

type ZodIssueLike = {
	path: PropertyKey[];
	code: string;
	message: string;
	keys?: string[];
};

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

function zodPathToJsonPointer(path: PropertyKey[]): string {
	if (path.length === 0) {
		return "";
	}

	return path
		.map((segment) =>
			typeof segment === "number" ? `/${segment}` : `/${String(segment)}`,
		)
		.join("");
}

function zodIssueToDetail(issue: ZodIssueLike): ApiErrorDetail {
	let path = zodPathToJsonPointer(issue.path);

	if (issue.code === "unrecognized_keys" && issue.keys) {
		const [unrecognizedKey] = issue.keys;
		if (typeof unrecognizedKey === "string") {
			path = path ? `${path}/${unrecognizedKey}` : `/${unrecognizedKey}`;
		}
	}

	return {
		path,
		code: "VALIDATION_FAILED",
		message: issue.message,
	};
}

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
		return result.error.issues.map(zodIssueToDetail);
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
