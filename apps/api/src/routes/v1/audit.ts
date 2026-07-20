// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { AuditRepo } from "@usetagih/core";
import { listAuditUseCase } from "@usetagih/core";
import { VALIDATION_FAILED_CODE, zodIssuesToDetails } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";
import { ListAuditQuerySchema } from "./audit.schemas.js";

export function createAuditRoutes(deps: { auditRepo: AuditRepo }) {
	return new Elysia().get(
		"/audit",
		async ({ query, request, status, set, workspaceId }) => {
			const requestId = getRequestId(request);
			const parsed = ListAuditQuerySchema.safeParse(query);
			if (!parsed.success) {
				return statusApiError(status, set, {
					code: VALIDATION_FAILED_CODE,
					message: "Request validation failed",
					requestId,
					details: zodIssuesToDetails(parsed.error),
				});
			}

			return listAuditUseCase(
				{
					workspaceId,
					page: parsed.data.page,
					pageSize: parsed.data.pageSize,
				},
				deps.auditRepo,
			);
		},
		{ authenticated: true, requireScope: "audit:read" } as never,
	);
}
