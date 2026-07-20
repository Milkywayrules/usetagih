// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { Elysia } from "elysia";

export function createAuditStubRoutes() {
	return new Elysia().get(
		"/audit",
		({ set }) => {
			set.status = 501;
			return {
				error: {
					code: "NOT_IMPLEMENTED",
					message: "Audit list lands in Story 3.14",
				},
			};
		},
		{ authenticated: true, requireScope: "audit:read" } as never,
	);
}
