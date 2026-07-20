// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { ArtifactStore, RenderRepo } from "@usetagih/core";
import { downloadShareUseCase, resolveShareUseCase } from "@usetagih/core";
import { FORBIDDEN_CODE, NOT_FOUND_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";

export function createShareRoutes(deps: {
	renderRepo: RenderRepo;
	artifactStore: ArtifactStore;
	shareSigningSecret: string;
}) {
	return new Elysia()
		.get("/share/:token", async ({ params, request, status, set }) => {
			const requestId = getRequestId(request);
			const token = decodeURIComponent(params.token);
			const result = await resolveShareUseCase(
				{
					token,
					shareSigningSecret: deps.shareSigningSecret,
				},
				deps.renderRepo,
			);

			if (!result.ok) {
				if (result.code === "EXPIRED" || result.code === "REVOKED") {
					return statusApiError(status, set, {
						code: FORBIDDEN_CODE,
						message: result.message,
						requestId,
					});
				}
				return statusApiError(status, set, {
					code: NOT_FOUND_CODE,
					message: result.message,
					requestId,
				});
			}

			return result.metadata;
		})
		.get("/share/:token/download", async ({ params, request, status, set }) => {
			const requestId = getRequestId(request);
			const token = decodeURIComponent(params.token);
			const result = await downloadShareUseCase(
				{
					token,
					shareSigningSecret: deps.shareSigningSecret,
				},
				{
					renderRepo: deps.renderRepo,
					artifactStore: deps.artifactStore,
				},
			);

			if (!result.ok) {
				if (result.code === "EXPIRED" || result.code === "REVOKED") {
					return statusApiError(status, set, {
						code: FORBIDDEN_CODE,
						message: result.message,
						requestId,
					});
				}
				return statusApiError(status, set, {
					code: NOT_FOUND_CODE,
					message: result.message,
					requestId,
				});
			}

			set.headers = {
				...set.headers,
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${result.filename}"`,
			};

			return result.pdfBytes;
		});
}
