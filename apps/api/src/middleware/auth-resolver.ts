import type { ApiKeyRepo } from "@usetagih/core";
import { auth } from "@usetagih/db";
import {
	SESSION_TOKEN_SCOPES,
	UNAUTHORIZED_CODE,
	WORKSPACE_REQUIRED_CODE,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import type { ApiEnv } from "../env.js";
import { statusApiError } from "../lib/api-error.js";
import type { AuthContext } from "./auth-context.js";
import { resolveBearerAuth } from "./bearer-auth.js";
import { getRequestId } from "./request-id.js";

export function createAuthResolver(options: {
	env: ApiEnv;
	apiKeyRepo: ApiKeyRepo;
}) {
	return new Elysia({ name: "auth-resolver" }).macro({
		authenticated: {
			async resolve({
				request,
				status,
				set,
			}: {
				request: Request;
				status: (code: number, body: unknown) => unknown;
				set: { headers?: Record<string, unknown> };
			}) {
				const { headers } = request;
				const authorization = headers.get("authorization");
				if (authorization?.startsWith("Bearer ")) {
					const authContext = await resolveBearerAuth(
						authorization,
						options.env,
						options.apiKeyRepo,
					);
					if (!authContext) {
						return statusApiError(status, set, {
							code: UNAUTHORIZED_CODE,
							message: "Authentication required",
							request,
							requestId: getRequestId(request),
						}) as never;
					}

					return {
						authContext,
						userId: authContext.userId,
						workspaceId: authContext.workspaceId,
					};
				}

				const session = await auth.api.getSession({ headers });
				if (!session) {
					return statusApiError(status, set, {
						code: UNAUTHORIZED_CODE,
						message: "Authentication required",
						request,
						requestId: getRequestId(request),
					}) as never;
				}

				const organizations = await auth.api.listOrganizations({ headers });
				const activeOrganizationId = session.session.activeOrganizationId;
				if (organizations.length === 0 || !activeOrganizationId) {
					return statusApiError(status, set, {
						code: WORKSPACE_REQUIRED_CODE,
						message: "Active workspace required",
						request,
						requestId: getRequestId(request),
					}) as never;
				}

				const ownsActiveWorkspace = organizations.some(
					(org) => org.id === activeOrganizationId,
				);
				if (!ownsActiveWorkspace) {
					return statusApiError(status, set, {
						code: WORKSPACE_REQUIRED_CODE,
						message: "Active workspace required",
						request,
						requestId: getRequestId(request),
					}) as never;
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
	} as never);
}
