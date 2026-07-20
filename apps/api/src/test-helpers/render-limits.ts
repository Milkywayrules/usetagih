import {
	createInMemoryRenderRateLimiter,
	createInMemoryUsageCounterRepo,
	createRenderLimitsService,
} from "@usetagih/core";

export function createTestRenderLimitsService(options?: { now?: () => Date }) {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: createInMemoryRenderRateLimiter(),
		now: options?.now,
	});
	return { service, usageCounterRepo };
}

export function createExhaustedQuotaRenderLimitsService(options: {
	tier: "trial" | "starter" | "pro" | "business";
	now?: () => Date;
}) {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: createInMemoryRenderRateLimiter(),
		now: options.now,
	});

	return {
		service,
		async primeQuota(workspaceId: string) {
			const limits = {
				trial: 100,
				starter: 1_000,
				pro: 2_000,
				business: 10_000,
			} as const;
			for (let i = 0; i < limits[options.tier]; i += 1) {
				await service.recordSuccessfulRender({
					workspaceId,
					tier: options.tier,
				});
			}
		},
	};
}
