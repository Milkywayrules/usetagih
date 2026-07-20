// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { NOT_IMPLEMENTED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";

export function createAuditStubRoutes() {
	return new Elysia().get(
		"/audit",
		({ request, set }) =>
			respondApiError({
				set,
				code: NOT_IMPLEMENTED_CODE,
				message: "Audit list lands in Story 3.14",
				requestId: getRequestId(request),
			}),
		{ authenticated: true, requireScope: "audit:read" } as never,
	);
}
