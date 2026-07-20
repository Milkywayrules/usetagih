import type { WorkspaceSettingsRepo } from "@usetagih/db";
import type { BusinessIdentity } from "@usetagih/schema";

type StoredSettings = {
	tier: "trial" | "starter" | "pro" | "business";
	branding: { logoUrl?: string; accentColor?: string } | null;
	businessIdentity: BusinessIdentity | null;
};

export function createInMemoryWorkspaceSettingsRepo(
	initial?: Map<string, StoredSettings>,
): WorkspaceSettingsRepo {
	const store = initial ?? new Map<string, StoredSettings>();

	function ensure(orgId: string): StoredSettings {
		let row = store.get(orgId);
		if (!row) {
			row = { tier: "trial", branding: null, businessIdentity: null };
			store.set(orgId, row);
		}
		return row;
	}

	return {
		async getByOrganizationId(organizationId) {
			const row = store.get(organizationId);
			if (!row) {
				return null;
			}
			return { tier: row.tier, branding: row.branding };
		},

		async getFullByOrganizationId(organizationId) {
			const row = store.get(organizationId);
			if (!row) {
				return null;
			}
			return { ...row };
		},

		async updateBusinessIdentity(organizationId, patch) {
			const row = ensure(organizationId);
			row.businessIdentity = { ...(row.businessIdentity ?? {}), ...patch };
			return row.businessIdentity;
		},

		async updateBranding(organizationId, patch) {
			const row = ensure(organizationId);
			row.branding = { ...(row.branding ?? {}), ...patch };
			return row.branding;
		},
	};
}
