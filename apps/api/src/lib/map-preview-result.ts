import type { PreviewUseCaseResult } from "@usetagih/core";
import { respondApiErrorFromContext } from "./api-error.js";

type PreviewResponseContext = {
	requestId: string;
	set: { status?: number | string; headers?: Record<string, unknown> };
	request?: Request;
};

export type PreviewSuccessBody = {
	valid: true;
	pageCount: number;
	pages: Array<{ index: number; svg: string }>;
	html: string;
};

export function mapPreviewResultToResponse(
	ctx: PreviewResponseContext,
	result: PreviewUseCaseResult,
): PreviewSuccessBody | ReturnType<typeof respondApiErrorFromContext> {
	if (result.ok) {
		return {
			valid: true,
			pageCount: result.pageCount,
			pages: result.pages,
			html: result.html,
		};
	}

	const message = result.details[0]?.message ?? "Preview failed";

	return respondApiErrorFromContext(ctx, {
		code: result.code,
		message,
		details: result.details,
	});
}
