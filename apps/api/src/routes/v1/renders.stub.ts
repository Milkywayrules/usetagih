// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { NOT_IMPLEMENTED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";

export function createRendersStubRoutes() {
	return new Elysia()
		.get(
			"/renders",
			({ request, set }) =>
				respondApiError({
					set,
					code: NOT_IMPLEMENTED_CODE,
					message: "Render list lands in Story 3.12",
					requestId: getRequestId(request),
				}),
			{ authenticated: true, requireScope: "renders:read" } as never,
		)
		.post(
			"/renders",
			({ request, set }) =>
				respondApiError({
					set,
					code: NOT_IMPLEMENTED_CODE,
					message: "Render create lands in Story 3.11",
					requestId: getRequestId(request),
				}),
			{ authenticated: true, requireScope: "renders:write" } as never,
		);
}
