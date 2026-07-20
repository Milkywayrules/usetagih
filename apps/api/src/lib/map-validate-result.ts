import type { ValidateUseCaseResult } from "@usetagih/core";
import type { DocumentPayload, ErrorCode } from "@usetagih/schema";
import { respondApiErrorFromContext } from "./api-error.js";

type ValidateResponseContext = {
	requestId: string;
	set: { status?: number | string; headers?: Record<string, unknown> };
	request?: Request;
};

function defaultMessageForCode(code: ErrorCode): string {
	if (code === "VALIDATION_FAILED") {
		return "Validation failed";
	}
	return "Validation failed";
}

export type ValidateSuccessBody = {
	valid: true;
	normalizedPreview: DocumentPayload;
};

export function mapValidateResultToResponse(
	ctx: ValidateResponseContext,
	result: ValidateUseCaseResult,
): ValidateSuccessBody | ReturnType<typeof respondApiErrorFromContext> {
	if (result.valid) {
		return {
			valid: true,
			normalizedPreview: result.normalizedPreview,
		};
	}

	const message =
		result.details[0]?.message ?? defaultMessageForCode(result.code);

	return respondApiErrorFromContext(ctx, {
		code: result.code,
		message,
		details: result.details,
	});
}
