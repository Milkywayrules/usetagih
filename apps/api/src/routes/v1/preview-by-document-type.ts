// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { previewUseCase } from "@usetagih/core";
import type { WorkspaceSettingsRepo } from "@usetagih/db";
import { Elysia } from "elysia";
import {
	DOCUMENT_TYPE_PATHS,
	PATH_SEGMENT_TO_DOCUMENT_TYPE,
} from "../../lib/document-type-paths.js";
import { mapPreviewResultToResponse } from "../../lib/map-preview-result.js";
import type { PreviewRuntimeDeps } from "../../lib/preview-deps.js";

export type PreviewByDocumentTypeDeps = {
	workspaceSettingsRepo: WorkspaceSettingsRepo;
	previewRuntime: PreviewRuntimeDeps;
};

export function createPreviewByDocumentTypeRoutes(
	deps: PreviewByDocumentTypeDeps,
) {
	let app = new Elysia({ name: "preview-by-document-type" });

	for (const documentTypePath of DOCUMENT_TYPE_PATHS) {
		const pathDocumentType = PATH_SEGMENT_TO_DOCUMENT_TYPE[documentTypePath];

		app = app.post(
			`/${documentTypePath}/preview`,
			async ({ body, requestId, set, request, authContext }) => {
				const settings = await deps.workspaceSettingsRepo.getByOrganizationId(
					authContext.workspaceId,
				);
				const workspaceTier = settings?.tier ?? "trial";
				const workspaceBranding = settings?.branding ?? null;

				const result = await previewUseCase(
					{
						pathDocumentType,
						rawPayload: body,
						workspaceId: authContext.workspaceId,
						workspaceTier,
						workspaceBranding,
					},
					deps.previewRuntime.createPreviewUseCaseDeps(authContext.workspaceId),
				);

				return mapPreviewResultToResponse({ requestId, set, request }, result);
			},
			{
				authenticated: true,
				requireScope: "renders:write",
			} as never,
		);
	}

	return app;
}
