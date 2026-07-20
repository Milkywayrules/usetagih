import type { WorkspaceTier } from "@usetagih/core";
import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { workspaceSettings } from "../schema/workspace-settings.js";

export type WorkspaceSettingsRecord = {
	tier: WorkspaceTier;
	branding: { logoUrl?: string; accentColor?: string } | null;
};

export function createWorkspaceSettingsRepo(db: Db) {
	return {
		async getByOrganizationId(
			organizationId: string,
		): Promise<WorkspaceSettingsRecord | null> {
			const rows = await db
				.select({
					tier: workspaceSettings.tier,
					branding: workspaceSettings.branding,
				})
				.from(workspaceSettings)
				.where(eq(workspaceSettings.organizationId, organizationId))
				.limit(1);

			const row = rows[0];
			if (!row) {
				return null;
			}

			const branding =
				row.branding &&
				typeof row.branding === "object" &&
				!Array.isArray(row.branding)
					? (row.branding as { logoUrl?: string; accentColor?: string })
					: null;

			return {
				tier: row.tier,
				branding,
			};
		},
	};
}

export type WorkspaceSettingsRepo = ReturnType<
	typeof createWorkspaceSettingsRepo
>;
