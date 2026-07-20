import type { RenderUseCaseResult } from "@usetagih/core";
import { respondApiErrorFromContext } from "./api-error.js";

type RenderResponseContext = {
	requestId: string;
	set: {
		status?: number | string;
		headers?: Record<string, string | number | undefined>;
	};
	request?: Request;
};

export type RenderSuccessBody = {
	renderId: string;
	status: "completed";
	shareUrl: string;
	expiresAt: string;
	schemaVersion: string;
	documentType: string;
	template: string;
};

export function mapRenderResultToResponse(
	ctx: RenderResponseContext,
	result: RenderUseCaseResult,
): RenderSuccessBody | ReturnType<typeof respondApiErrorFromContext> {
	if (result.ok) {
		ctx.set.status = 201;
		ctx.set.headers = {
			...ctx.set.headers,
			Location: `/v1/renders/${result.renderId}`,
		};

		return {
			renderId: result.renderId,
			status: result.status,
			shareUrl: result.shareUrl,
			expiresAt: result.expiresAt,
			schemaVersion: result.schemaVersion,
			documentType: result.documentType,
			template: result.template,
		};
	}

	const message = result.details[0]?.message ?? "Render failed";

	return respondApiErrorFromContext(ctx, {
		code: result.code,
		message,
		details: result.details,
	});
}
