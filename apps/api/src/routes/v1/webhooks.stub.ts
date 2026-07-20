// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { NOT_IMPLEMENTED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";

export function createWebhooksStubRoutes() {
	return new Elysia()
		.get(
			"/webhooks",
			({ request, set }) =>
				respondApiError({
					set,
					code: NOT_IMPLEMENTED_CODE,
					message: "Webhook list lands in Story 4.3",
					requestId: getRequestId(request),
				}),
			{ authenticated: true, requireScope: "webhooks:manage" } as never,
		)
		.post(
			"/webhooks",
			({ request, set }) =>
				respondApiError({
					set,
					code: NOT_IMPLEMENTED_CODE,
					message: "Webhook create lands in Story 4.3",
					requestId: getRequestId(request),
				}),
			{ authenticated: true, requireScope: "webhooks:manage" } as never,
		);
}
