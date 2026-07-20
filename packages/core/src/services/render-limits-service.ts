import type { WorkspaceTier } from "../ports/domain-types.js";
import type { RenderRateLimiter } from "../ports/render-rate-limiter.js";
import type { UsageCounterRepo } from "../ports/usage-counter-repo.js";
import {
	currentUsageMonth,
	formatQuotaExceededMessage,
	formatRateLimitedMessage,
	getMonthlyRenderQuota,
	getNextWorkspaceTier,
	getRateLimitRendersPerMin,
} from "../tier-limits.js";

export type RenderLimitsCheckResult =
	| { ok: true }
	| {
			ok: false;
			kind: "rate_limited";
			message: string;
			retryAfterSeconds: number;
	  }
	| {
			ok: false;
			kind: "quota_exceeded";
			message: string;
			tier: WorkspaceTier;
			nextTier: WorkspaceTier | null;
	  };

export function createRenderLimitsService(deps: {
	usageCounterRepo: UsageCounterRepo;
	renderRateLimiter: RenderRateLimiter;
	now?: () => Date;
}) {
	const now = deps.now ?? (() => new Date());

	return {
		async checkBeforeRender(input: {
			workspaceId: string;
			tier: WorkspaceTier;
		}): Promise<RenderLimitsCheckResult> {
			const rateLimit = getRateLimitRendersPerMin(input.tier);
			const rateResult = await deps.renderRateLimiter.checkAndConsume({
				workspaceId: input.workspaceId,
				limitPerMinute: rateLimit,
				now: now(),
			});

			if (!rateResult.allowed) {
				return {
					ok: false,
					kind: "rate_limited",
					message: formatRateLimitedMessage(input.tier),
					retryAfterSeconds: rateResult.retryAfterSeconds,
				};
			}

			const month = currentUsageMonth(now());
			const monthlyLimit = getMonthlyRenderQuota(input.tier);
			const currentCount = await deps.usageCounterRepo.getRenderCount({
				workspaceId: input.workspaceId,
				month,
			});

			if (currentCount >= monthlyLimit) {
				return {
					ok: false,
					kind: "quota_exceeded",
					message: formatQuotaExceededMessage(input.tier),
					tier: input.tier,
					nextTier: getNextWorkspaceTier(input.tier),
				};
			}

			return { ok: true };
		},

		async recordSuccessfulRender(input: {
			workspaceId: string;
			tier: WorkspaceTier;
		}): Promise<void> {
			const month = currentUsageMonth(now());
			const monthlyLimit = getMonthlyRenderQuota(input.tier);
			const result = await deps.usageCounterRepo.tryIncrementRenderCount({
				workspaceId: input.workspaceId,
				month,
				limit: monthlyLimit,
			});

			if (!result.ok) {
				throw new Error(
					`quota increment rejected after successful render for workspace ${input.workspaceId}`,
				);
			}
		},
	};
}

export type RenderLimitsService = ReturnType<typeof createRenderLimitsService>;
