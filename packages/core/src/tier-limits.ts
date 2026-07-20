import type { WorkspaceTier } from "./ports/domain-types.js";

export const WORKSPACE_TIERS = [
	"trial",
	"starter",
	"pro",
	"business",
] as const satisfies readonly WorkspaceTier[];

const MONTHLY_RENDER_QUOTAS: Record<WorkspaceTier, number> = {
	trial: 100,
	starter: 1_000,
	pro: 2_000,
	business: 10_000,
};

const RATE_LIMIT_RENDERS_PER_MIN: Record<WorkspaceTier, number> = {
	trial: 30,
	starter: 60,
	pro: 120,
	business: 300,
};

const NEXT_TIER: Partial<Record<WorkspaceTier, WorkspaceTier>> = {
	trial: "starter",
	starter: "pro",
	pro: "business",
};

export function getMonthlyRenderQuota(tier: WorkspaceTier): number {
	return MONTHLY_RENDER_QUOTAS[tier];
}

export function getRateLimitRendersPerMin(tier: WorkspaceTier): number {
	return RATE_LIMIT_RENDERS_PER_MIN[tier];
}

export function getNextWorkspaceTier(
	tier: WorkspaceTier,
): WorkspaceTier | null {
	return NEXT_TIER[tier] ?? null;
}

export function formatQuotaExceededMessage(tier: WorkspaceTier): string {
	const nextTier = getNextWorkspaceTier(tier);
	if (nextTier) {
		return `Monthly render quota exceeded for ${tier} tier. Upgrade to ${nextTier} for ${getMonthlyRenderQuota(nextTier).toLocaleString("en-US")} renders per month.`;
	}
	return `Monthly render quota exceeded for ${tier} tier. Contact sales for higher limits.`;
}

export function formatRateLimitedMessage(tier: WorkspaceTier): string {
	return `Rate limit exceeded for ${tier} tier (${getRateLimitRendersPerMin(tier)} renders per minute).`;
}

export function currentUsageMonth(date: Date = new Date()): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}-01`;
}
