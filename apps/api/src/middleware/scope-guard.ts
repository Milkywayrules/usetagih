import type { ApiScope } from "@usetagih/schema";
import { FORBIDDEN_CODE, UNAUTHORIZED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../lib/api-error.js";
import { type AuthContext, hasRequiredScopes } from "./auth-context.js";
import { getRequestId } from "./request-id.js";

export function createScopeGuard() {
	return new Elysia({ name: "scope-guard" }).macro({
		requireScope(required: ApiScope | ApiScope[]) {
			const scopes = Array.isArray(required) ? required : [required];
			return {
				async resolve({
					request,
					authContext,
					status,
					set,
				}: {
					request: Request;
					authContext?: AuthContext;
					status: (code: number, body: unknown) => unknown;
					set: { headers?: Record<string, unknown> };
				}) {
					if (!authContext) {
						return statusApiError(status, set, {
							code: UNAUTHORIZED_CODE,
							message: "Authentication required",
							request,
							requestId: getRequestId(request),
						}) as never;
					}

					if (!hasRequiredScopes(authContext, scopes)) {
						const missing = scopes.find(
							(scope) => !authContext.scopes.includes(scope),
						);
						return statusApiError(status, set, {
							code: FORBIDDEN_CODE,
							message: `Insufficient scope: requires ${missing ?? scopes[0]}`,
							request,
							requestId: getRequestId(request),
						}) as never;
					}

					return {} as Record<string, never>;
				},
			};
		},
	} as never);
}
