// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { Elysia } from "elysia";

export function createRendersStubRoutes() {
	return new Elysia()
		.get(
			"/renders",
			({ set }) => {
				set.status = 501;
				return {
					error: {
						code: "NOT_IMPLEMENTED",
						message: "Render list lands in Story 3.12",
					},
				};
			},
			{ authenticated: true, requireScope: "renders:read" } as never,
		)
		.post(
			"/renders",
			({ set }) => {
				set.status = 501;
				return {
					error: {
						code: "NOT_IMPLEMENTED",
						message: "Render create lands in Story 3.11",
					},
				};
			},
			{ authenticated: true, requireScope: "renders:write" } as never,
		);
}
