import { auth } from "@usetagih/db";
import { WORKSPACE_REQUIRED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";

export function createWorkspaceGuard() {
	return new Elysia({ name: "workspace-guard" }).macro({
		workspace: {
			async resolve({ request: { headers }, status }) {
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

				return {
					user: session.user,
					session: session.session,
					workspaceId: activeOrganizationId,
				};
			},
		},
	});
}
