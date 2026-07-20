import type { ApiScope } from "@usetagih/schema";
import { Elysia } from "elysia";
import { type AuthContext, hasRequiredScopes } from "./auth-context.js";

export function createScopeGuard() {
	return new Elysia({ name: "scope-guard" }).macro({
		requireScope(required: ApiScope | ApiScope[]) {
			const scopes = Array.isArray(required) ? required : [required];
			return {
				async resolve({
					authContext,
					status,
				}: {
					authContext?: AuthContext;
					status: (code: number, body: unknown) => unknown;
				}) {
					if (!authContext) {
						return status(401, {
							error: {
								code: "UNAUTHORIZED",
								message: "Authentication required",
							},
						});
					}

					if (!hasRequiredScopes(authContext, scopes)) {
						const missing = scopes.find(
							(scope) => !authContext.scopes.includes(scope),
						);
						return status(403, {
							error: {
								code: "FORBIDDEN",
								message: `Insufficient scope: requires ${missing ?? scopes[0]}`,
							},
						});
					}

					return {} as Record<string, never>;
				},
			};
		},
	} as never);
}
