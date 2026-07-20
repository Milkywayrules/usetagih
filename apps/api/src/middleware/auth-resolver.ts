import { auth } from "@usetagih/db";
import {
	SESSION_TOKEN_SCOPES,
	WORKSPACE_REQUIRED_CODE,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import type { ApiEnv } from "../env.js";
import type { AuthContext } from "./auth-context.js";
import { resolveBearerAuth } from "./bearer-auth.js";

export function createAuthResolver(options: { env: ApiEnv }) {
	return new Elysia({ name: "auth-resolver" }).macro({
		authenticated: {
			async resolve({ request: { headers }, status }) {
				const authorization = headers.get("authorization");
				if (authorization?.startsWith("Bearer ")) {
					const authContext = await resolveBearerAuth(
						authorization,
						options.env,
					);
					if (!authContext) {
						return status(401, {
							error: {
								code: "UNAUTHORIZED",
								message: "Authentication required",
							},
						});
					}

					return {
						authContext,
						userId: authContext.userId,
						workspaceId: authContext.workspaceId,
					};
				}

				const session = await auth.api.getSession({ headers });
				if (!session) {
					return status(401, {
						error: {
							code: "UNAUTHORIZED",
							message: "Authentication required",
						},
					});
				}

				const organizations = await auth.api.listOrganizations({ headers });
				const activeOrganizationId = session.session.activeOrganizationId;
				if (organizations.length === 0 || !activeOrganizationId) {
					return status(403, {
						error: {
							code: WORKSPACE_REQUIRED_CODE,
							message: "Active workspace required",
						},
					});
				}

				const ownsActiveWorkspace = organizations.some(
					(org) => org.id === activeOrganizationId,
				);
				if (!ownsActiveWorkspace) {
					return status(403, {
						error: {
							code: WORKSPACE_REQUIRED_CODE,
							message: "Active workspace required",
						},
					});
				}

				const authContext: AuthContext = {
					authType: "session",
					userId: session.user.id,
					workspaceId: activeOrganizationId,
					scopes: [...SESSION_TOKEN_SCOPES],
				};

				return {
					authContext,
					user: session.user,
					session: session.session,
					userId: session.user.id,
					workspaceId: activeOrganizationId,
				};
			},
		},
	});
}
