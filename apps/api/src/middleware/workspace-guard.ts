import { auth } from "@usetagih/db";
import { UNAUTHORIZED_CODE, WORKSPACE_REQUIRED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../lib/api-error.js";
import { getRequestId } from "./request-id.js";

export function createWorkspaceGuard() {
	return new Elysia({ name: "workspace-guard" }).macro({
		workspace: {
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

				return {
					user: session.user,
					session: session.session,
					workspaceId: activeOrganizationId,
				};
			},
		},
	} as never);
}
