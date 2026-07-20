// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { IdempotencyStore, RenderRepo } from "@usetagih/core";
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

export type RenderByDocumentTypeDeps = {
	idempotencyStore: IdempotencyStore;
	env: ApiEnv;
	renderRepo: RenderRepo;
	workspaceSettingsRepo: WorkspaceSettingsRepo;
	renderRuntime: RenderRuntimeDeps;
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
		log,
	}: {
		request: Request;
		requestId: string;
		set: {
			status?: number | string;
			headers?: Record<string, string | number | undefined>;
		};
		authContext: { workspaceId: string };
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
