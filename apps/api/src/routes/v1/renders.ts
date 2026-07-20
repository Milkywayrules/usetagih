// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { ArtifactStore, AuditRepo, RenderRepo } from "@usetagih/core";
import {
	downloadRenderUseCase,
	getRenderUseCase,
	listRendersUseCase,
	revokeShareUseCase,
} from "@usetagih/core";
import {
	INTERNAL_ERROR_CODE,
	NOT_FOUND_CODE,
	NOT_IMPLEMENTED_CODE,
	VALIDATION_FAILED_CODE,
	zodIssuesToDetails,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError, statusApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";
import {
	ListRendersQuerySchema,
	RenderIdParamSchema,
} from "./renders.schemas.js";

function clientIp(request: Request): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		null
	);
}

export function createRendersRoutes(deps: {
	renderRepo: RenderRepo;
	artifactStore: ArtifactStore;
	auditRepo: AuditRepo;
	webPublicUrl: string;
	resolveAuditUserId?: (
		workspaceId: string,
		userId?: string,
	) => Promise<string | null>;
}) {
	return new Elysia()
		.get(
			"/renders",
			async ({ query, request, status, set, workspaceId }) => {
				const requestId = getRequestId(request);
				const parsed = ListRendersQuerySchema.safeParse(query);
				if (!parsed.success) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: zodIssuesToDetails(parsed.error),
					});
				}

				const result = await listRendersUseCase(
					{
						workspaceId,
						webPublicUrl: deps.webPublicUrl,
						page: parsed.data.page,
						pageSize: parsed.data.pageSize,
						documentType: parsed.data.documentType,
						from: parsed.data.from ? new Date(parsed.data.from) : undefined,
						to: parsed.data.to ? new Date(parsed.data.to) : undefined,
					},
					deps.renderRepo,
				);

				return result;
			},
			{ authenticated: true, requireScope: "renders:read" } as never,
		)
		.get(
			"/renders/:renderId",
			async ({ params, request, status, set, workspaceId }) => {
				const requestId = getRequestId(request);
				const parsedParams = RenderIdParamSchema.safeParse(params);
				if (!parsedParams.success) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "Render not found",
						requestId,
					});
				}

				const result = await getRenderUseCase(
					{
						apiRenderId: parsedParams.data.renderId,
						workspaceId,
						webPublicUrl: deps.webPublicUrl,
					},
					deps.renderRepo,
				);

				if (!result.ok) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "Render not found",
						requestId,
					});
				}

				return result.render;
			},
			{ authenticated: true, requireScope: "renders:read" } as never,
		)
		.get(
			"/renders/:renderId/download",
			async ({
				params,
				request,
				status,
				set,
				workspaceId,
				userId,
				authContext,
			}) => {
				const requestId = getRequestId(request);
				const parsedParams = RenderIdParamSchema.safeParse(params);
				if (!parsedParams.success) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "Render not found",
						requestId,
					});
				}

				const result = await downloadRenderUseCase(
					{
						apiRenderId: parsedParams.data.renderId,
						workspaceId,
					},
					{
						renderRepo: deps.renderRepo,
						artifactStore: deps.artifactStore,
					},
				);

				if (!result.ok) {
					return statusApiError(status, set, {
						code:
							result.code === "INTERNAL_ERROR"
								? INTERNAL_ERROR_CODE
								: NOT_FOUND_CODE,
						message: result.message,
						requestId,
					});
				}

				const auditUserId =
					userId ??
					(await deps.resolveAuditUserId?.(workspaceId, userId)) ??
					null;
				if (!auditUserId) {
					return statusApiError(status, set, {
						code: INTERNAL_ERROR_CODE,
						message: "Audit actor missing",
						requestId,
					});
				}

				await deps.auditRepo.append({
					workspaceId,
					userId: auditUserId,
					action: "render.download",
					resourceType: "render",
					resourceId: parsedParams.data.renderId,
					outcome: "success",
					ip: clientIp(request),
					metadata: {
						sha256: result.sha256,
						authType: authContext.authType,
						...(authContext.apiKeyId ? { apiKeyId: authContext.apiKeyId } : {}),
					},
				});

				set.headers = {
					...set.headers,
					"Content-Type": "application/pdf",
					"Content-Disposition": `attachment; filename="${result.filename}"`,
				};

				return result.pdfBytes;
			},
			{ authenticated: true, requireScope: "renders:read" } as never,
		)
		.delete(
			"/renders/:renderId/share",
			async ({
				params,
				request,
				status,
				set,
				workspaceId,
				userId,
				authContext,
			}) => {
				const requestId = getRequestId(request);
				const parsedParams = RenderIdParamSchema.safeParse(params);
				if (!parsedParams.success) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "Render not found",
						requestId,
					});
				}

				const result = await revokeShareUseCase(
					{
						apiRenderId: parsedParams.data.renderId,
						workspaceId,
					},
					deps.renderRepo,
				);

				if (!result.ok) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "Render not found",
						requestId,
					});
				}

				if (result.revoked) {
					const auditUserId =
						userId ??
						(await deps.resolveAuditUserId?.(workspaceId, userId)) ??
						null;
					if (auditUserId) {
						await deps.auditRepo.append({
							workspaceId,
							userId: auditUserId,
							action: "share.revoke",
							resourceType: "render",
							resourceId: parsedParams.data.renderId,
							outcome: "success",
							ip: clientIp(request),
							metadata: {
								authType: authContext.authType,
								...(authContext.apiKeyId
									? { apiKeyId: authContext.apiKeyId }
									: {}),
							},
						});
					}
				}

				return { renderId: result.renderId, revoked: result.revoked };
			},
			{ authenticated: true, requireScope: "renders:write" } as never,
		)
		.post(
			"/renders",
			({ request, set }) =>
				respondApiError({
					set,
					code: NOT_IMPLEMENTED_CODE,
					message: "Use POST /v1/{documentType}/render to create renders",
					requestId: getRequestId(request),
				}),
			{ authenticated: true, requireScope: "renders:write" } as never,
		);
}
