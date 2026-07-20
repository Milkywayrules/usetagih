// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { Elysia } from "elysia";
import type { ApiEnv } from "../../env.js";
import { appendCsrfCookie } from "../../middleware/csrf.js";

export function createSessionCsrfRoute(options: { env: ApiEnv }) {
	return new Elysia().get(
		"/session/csrf",
		({ request, set, session }) => {
			appendCsrfCookie(
				set,
				request,
				options.env.BETTER_AUTH_SECRET,
				session.id,
			);
			return { ok: true };
		},
		{ auth: true } as never,
	);
}
