// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { Elysia } from "elysia";

export function createWebhooksStubRoutes() {
	return new Elysia()
		.get(
			"/webhooks",
			({ set }) => {
				set.status = 501;
				return {
					error: {
						code: "NOT_IMPLEMENTED",
						message: "Webhook list lands in Story 4.3",
					},
				};
			},
			{ authenticated: true, requireScope: "webhooks:manage" } as never,
		)
		.post(
			"/webhooks",
			({ set }) => {
				set.status = 501;
				return {
					error: {
						code: "NOT_IMPLEMENTED",
						message: "Webhook create lands in Story 4.3",
					},
				};
			},
			{ authenticated: true, requireScope: "webhooks:manage" } as never,
		);
}
