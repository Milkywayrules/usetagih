import type { WorkspaceTier } from "@usetagih/core";

export type TypstTierInput = "free" | "pro";

export function mapWorkspaceTierToTypstTier(
	tier: WorkspaceTier,
): TypstTierInput {
	return tier === "trial" ? "free" : "pro";
}
