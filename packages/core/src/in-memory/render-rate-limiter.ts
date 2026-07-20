import type {
	RenderRateLimiter,
	RenderRateLimitResult,
} from "../ports/render-rate-limiter.js";

type WindowState = {
	windowStartMs: number;
	count: number;
};

export function createInMemoryRenderRateLimiter(): RenderRateLimiter {
	const windows = new Map<string, WindowState>();

	return {
		checkAndConsume({ workspaceId, limitPerMinute, now = new Date() }) {
			const nowMs = now.getTime();
			const windowStartMs = Math.floor(nowMs / 60_000) * 60_000;
			const existing = windows.get(workspaceId);

			if (!existing || existing.windowStartMs !== windowStartMs) {
				windows.set(workspaceId, { windowStartMs, count: 1 });
				return { allowed: true };
			}

			if (existing.count >= limitPerMinute) {
				const retryAfterSeconds = Math.max(
					1,
					Math.ceil((windowStartMs + 60_000 - nowMs) / 1_000),
				);
				return {
					allowed: false,
					retryAfterSeconds,
				} satisfies RenderRateLimitResult;
			}

			existing.count += 1;
			return { allowed: true };
		},
	};
}
