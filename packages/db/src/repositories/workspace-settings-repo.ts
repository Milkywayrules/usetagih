import type { WorkspaceTier } from "@usetagih/core";
import type { BusinessIdentity } from "@usetagih/schema";
import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { workspaceSettings } from "../schema/workspace-settings.js";

export type WorkspaceBranding = {
	logoUrl?: string;
	accentColor?: string;
};

export type WorkspaceSettingsRecord = {
	tier: WorkspaceTier;
	branding: WorkspaceBranding | null;
};

export type WorkspaceSettingsFullRecord = WorkspaceSettingsRecord & {
	businessIdentity: BusinessIdentity | null;
};

function parseBranding(value: unknown): WorkspaceBranding | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as WorkspaceBranding;
}

function parseBusinessIdentity(value: unknown): BusinessIdentity | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as BusinessIdentity;
}

function mergeJsonRecord<T extends Record<string, unknown>>(
	existing: T | null,
	patch: Partial<T>,
): T {
	return { ...(existing ?? {}), ...patch } as T;
}

export function createWorkspaceSettingsRepo(db: Db) {
	return {
		async getByOrganizationId(
			organizationId: string,
		): Promise<WorkspaceSettingsRecord | null> {
			const full = await this.getFullByOrganizationId(organizationId);
			if (!full) {
				return null;
			}
			return {
				tier: full.tier,
				branding: full.branding,
			};
		},

		async getFullByOrganizationId(
			organizationId: string,
		): Promise<WorkspaceSettingsFullRecord | null> {
			const rows = await db
				.select({
					tier: workspaceSettings.tier,
					branding: workspaceSettings.branding,
					businessIdentity: workspaceSettings.businessIdentity,
				})
				.from(workspaceSettings)
				.where(eq(workspaceSettings.organizationId, organizationId))
				.limit(1);

			const row = rows[0];
			if (!row) {
				return null;
			}

			return {
				tier: row.tier,
				branding: parseBranding(row.branding),
				businessIdentity: parseBusinessIdentity(row.businessIdentity),
			};
		},

		async updateBusinessIdentity(
			organizationId: string,
			patch: Partial<BusinessIdentity>,
		): Promise<BusinessIdentity> {
			const existing = await this.getFullByOrganizationId(organizationId);
			if (!existing) {
				throw new Error("workspace settings not found");
			}

			const next = mergeJsonRecord(existing.businessIdentity, patch);
			await db
				.update(workspaceSettings)
				.set({ businessIdentity: next })
				.where(eq(workspaceSettings.organizationId, organizationId));

			return next;
		},

		async updateBranding(
			organizationId: string,
			patch: Partial<WorkspaceBranding>,
		): Promise<WorkspaceBranding> {
			const existing = await this.getFullByOrganizationId(organizationId);
			if (!existing) {
				throw new Error("workspace settings not found");
			}

			const next = mergeJsonRecord(existing.branding, patch);
			await db
				.update(workspaceSettings)
				.set({ branding: next })
				.where(eq(workspaceSettings.organizationId, organizationId));

			return next;
		},
	};
}

export type WorkspaceSettingsRepo = ReturnType<
	typeof createWorkspaceSettingsRepo
>;
