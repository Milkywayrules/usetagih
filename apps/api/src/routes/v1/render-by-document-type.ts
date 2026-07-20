// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { AuditRepo, IdempotencyStore, RenderRepo } from "@usetagih/core";
import { renderUseCase } from "@usetagih/core";
import type { WorkspaceSettingsRepo } from "@usetagih/db";
import { Elysia } from "elysia";
import type { ApiEnv } from "../../env.js";
import {
	DOCUMENT_TYPE_PATHS,
	PATH_SEGMENT_TO_DOCUMENT_TYPE,
} from "../../lib/document-type-paths.js";
import { mapRenderResultToResponse } from "../../lib/map-render-result.js";
import type { RenderRuntimeDeps } from "../../lib/render-deps.js";
import {
	createIdempotencyMiddleware,
	getIdempotencyContext,
} from "../../middleware/idempotency.js";

function clientIp(request: Request): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		null
	);
}

export type RenderByDocumentTypeDeps = {
	idempotencyStore: IdempotencyStore;
	env: ApiEnv;
	renderRepo: RenderRepo;
	workspaceSettingsRepo: WorkspaceSettingsRepo;
	renderRuntime: RenderRuntimeDeps;
	auditRepo: AuditRepo;
	resolveAuditUserId?: (
		workspaceId: string,
		userId?: string,
	) => Promise<string | null>;
	onRenderInvoked?: () => void;
};

function createRenderHandler(
	documentTypePath: (typeof DOCUMENT_TYPE_PATHS)[number],
	deps: RenderByDocumentTypeDeps,
) {
	const pathDocumentType = PATH_SEGMENT_TO_DOCUMENT_TYPE[documentTypePath];
	const webPublicUrl = deps.env.USETAGIH_WEB_PUBLIC_URL.replace(/\/$/, "");

	return async ({
		request,
		requestId,
		set,
		authContext,
		userId,
		log,
	}: {
		request: Request;
		requestId: string;
		set: {
			status?: number | string;
			headers?: Record<string, string | number | undefined>;
		};
		authContext: {
			workspaceId: string;
			authType: "session" | "session_bearer" | "api_key";
			apiKeyId?: string;
		};
		userId?: string;
		log: {
			set: (fields: Record<string, unknown>) => void;
			info: (message: string) => void;
		};
	}) => {
		const idempotencyContext = getIdempotencyContext(request);
		const rawPayload =
			idempotencyContext?.rawBody === ""
				? {}
				: idempotencyContext?.rawBody
					? JSON.parse(idempotencyContext.rawBody)
					: await request.json();

		const settings = await deps.workspaceSettingsRepo.getByOrganizationId(
			authContext.workspaceId,
		);
		const workspaceTier = settings?.tier ?? "trial";
		const workspaceBranding = settings?.branding ?? null;

		const result = await renderUseCase(
			{
				pathDocumentType,
				rawPayload,
				workspaceId: authContext.workspaceId,
				workspaceTier,
				workspaceBranding,
				idempotencyHash: idempotencyContext?.keyHash ?? null,
				webPublicUrl,
			},
			deps.renderRuntime.createRenderUseCaseDeps(
				authContext.workspaceId,
				deps.renderRepo,
			),
		);

		if (result.ok) {
			deps.onRenderInvoked?.();
			const auditUserId =
				userId ??
				(await deps.resolveAuditUserId?.(authContext.workspaceId, userId)) ??
				null;
			if (auditUserId) {
				await deps.auditRepo.append({
					workspaceId: authContext.workspaceId,
					userId: auditUserId,
					action: "render",
					resourceType: "render",
					resourceId: result.renderId,
					outcome: "success",
					ip: clientIp(request),
					metadata: {
						documentType: result.documentType,
						template: result.template,
						authType: authContext.authType,
						...(authContext.apiKeyId ? { apiKeyId: authContext.apiKeyId } : {}),
					},
				});
			}
			log.set({
				renderId: result.renderId,
				documentType: result.documentType,
				template: result.template,
				lineItemCount: result.lineItemCount,
				durationMs: result.stages.totalMs,
				stage: "render.completed",
				validateMs: result.stages.validateMs,
				logoMs: result.stages.logoMs,
				typstMs: result.stages.typstMs,
				uploadMs: result.stages.uploadMs,
				persistMs: result.stages.persistMs,
			});
			log.info("render.completed");
		}

		return mapRenderResultToResponse({ requestId, set, request }, result);
	};
}

export function createRenderByDocumentTypeRoutes(
	deps: RenderByDocumentTypeDeps,
) {
	let app = new Elysia({ name: "render-by-document-type" });

	for (const documentTypePath of DOCUMENT_TYPE_PATHS) {
		app = app.use(
			createIdempotencyMiddleware({
				idempotencyStore: deps.idempotencyStore,
				documentTypePath,
				handler: createRenderHandler(documentTypePath, deps),
			}),
		);
	}

	return app;
}
