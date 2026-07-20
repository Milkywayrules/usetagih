// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { AuditRepo } from "@usetagih/core";
import { validateUseCase } from "@usetagih/core";
import { Elysia } from "elysia";
import {
	DOCUMENT_TYPE_PATHS,
	PATH_SEGMENT_TO_DOCUMENT_TYPE,
} from "../../lib/document-type-paths.js";
import { mapValidateResultToResponse } from "../../lib/map-validate-result.js";

function clientIp(request: Request): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		null
	);
}

export function createValidateByDocumentTypeRoutes(deps: {
	auditRepo: AuditRepo;
	resolveAuditUserId?: (
		workspaceId: string,
		userId?: string,
	) => Promise<string | null>;
}) {
	let app = new Elysia({ name: "validate-by-document-type" });

	for (const documentTypePath of DOCUMENT_TYPE_PATHS) {
		const pathDocumentType = PATH_SEGMENT_TO_DOCUMENT_TYPE[documentTypePath];

		app = app.post(
			`/${documentTypePath}/validate`,
			async ({
				body,
				requestId,
				set,
				request,
				workspaceId,
				userId,
				authContext,
			}) => {
				const result = validateUseCase({
					pathDocumentType,
					rawPayload: body,
				});

				const auditUserId =
					userId ??
					(await deps.resolveAuditUserId?.(workspaceId, userId)) ??
					null;
				if (auditUserId) {
					await deps.auditRepo.append({
						workspaceId,
						userId: auditUserId,
						action: "validate",
						resourceType: "document",
						resourceId: pathDocumentType,
						outcome: result.valid ? "success" : "failure",
						ip: clientIp(request),
						metadata: {
							documentType: pathDocumentType,
							authType: authContext.authType,
							...(authContext.apiKeyId
								? { apiKeyId: authContext.apiKeyId }
								: {}),
						},
					});
				}

				return mapValidateResultToResponse({ requestId, set, request }, result);
			},
			{
				authenticated: true,
				requireScope: "renders:write",
			} as never,
		);
	}

	return app;
}
