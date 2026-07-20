import { expect, test } from "bun:test";
import { createInMemoryRenderRateLimiter } from "../in-memory/render-rate-limiter.js";
import { createInMemoryUsageCounterRepo } from "../in-memory/usage-counter-repo.js";
import { createRenderLimitsService } from "./render-limits-service.js";

const fixedNow = () => new Date("2026-07-20T12:00:00.000Z");

test("allows render when under rate and quota limits", async () => {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: createInMemoryRenderRateLimiter(),
		now: fixedNow,
	});

	const result = await service.checkBeforeRender({
		workspaceId: "ws-1",
		tier: "trial",
	});
	expect(result.ok).toBe(true);
});

test("returns rate_limited when per-minute limit exceeded", async () => {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const rateLimiter = createInMemoryRenderRateLimiter();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: rateLimiter,
		now: fixedNow,
	});

	for (let i = 0; i < 30; i += 1) {
		const allowed = await service.checkBeforeRender({
			workspaceId: "ws-rate",
			tier: "trial",
		});
		expect(allowed.ok).toBe(true);
	}

	const blocked = await service.checkBeforeRender({
		workspaceId: "ws-rate",
		tier: "trial",
	});
	expect(blocked.ok).toBe(false);
	if (!blocked.ok && blocked.kind === "rate_limited") {
		expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
	}
});

test("returns quota_exceeded at monthly boundary per tier", async () => {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: createInMemoryRenderRateLimiter(),
		now: fixedNow,
	});

	const workspaceId = "ws-quota";
	for (let i = 0; i < 100; i += 1) {
		await service.recordSuccessfulRender({ workspaceId, tier: "trial" });
	}

	const blocked = await service.checkBeforeRender({
		workspaceId,
		tier: "trial",
	});
	expect(blocked.ok).toBe(false);
	if (!blocked.ok && blocked.kind === "quota_exceeded") {
		expect(blocked.tier).toBe("trial");
		expect(blocked.nextTier).toBe("starter");
		expect(blocked.message).toContain("starter");
	}
});

test("recordSuccessfulRender respects monthly limit atomically", async () => {
	const usageCounterRepo = createInMemoryUsageCounterRepo();
	const service = createRenderLimitsService({
		usageCounterRepo,
		renderRateLimiter: createInMemoryRenderRateLimiter(),
		now: fixedNow,
	});

	const workspaceId = "ws-atomic";
	for (let i = 0; i < 100; i += 1) {
		await service.recordSuccessfulRender({ workspaceId, tier: "trial" });
	}

	await expect(
		service.recordSuccessfulRender({ workspaceId, tier: "trial" }),
	).rejects.toThrow(/quota increment rejected/);
});
