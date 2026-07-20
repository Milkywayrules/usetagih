// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { FORBIDDEN_CODE, SESSION_TOKEN_SCOPES } from "@usetagih/schema";
import { Elysia } from "elysia";
import { signSessionBearerToken } from "../../auth/session-token.js";
import type { ApiEnv } from "../../env.js";
import { respondApiError } from "../../lib/api-error.js";
import { validateCsrfDoubleSubmit } from "../../middleware/csrf.js";
import { getRequestId } from "../../middleware/request-id.js";

export function createSessionTokenRoute(options: { env: ApiEnv }) {
	return new Elysia().post(
		"/session/token",
		async ({ request, set, user, workspaceId, session }) => {
			if (
				!validateCsrfDoubleSubmit(
					request,
					options.env.BETTER_AUTH_SECRET,
					session.id,
				)
			) {
				return respondApiError({
					set,
					code: FORBIDDEN_CODE,
					message: "CSRF validation failed",
					requestId: getRequestId(request),
				});
			}

			const signed = await signSessionBearerToken(
				{ userId: user.id, workspaceId },
				options.env,
			);

			return {
				accessToken: signed.accessToken,
				tokenType: "Bearer" as const,
				expiresIn: signed.expiresIn,
				scopes: [...SESSION_TOKEN_SCOPES],
				workspaceId,
			};
		},
		{ workspace: true } as never,
	);
}
