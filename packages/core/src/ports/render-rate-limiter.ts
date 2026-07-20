export type RenderRateLimitResult =
	| { allowed: true }
	| { allowed: false; retryAfterSeconds: number };

export type RenderRateLimiter = {
	checkAndConsume(input: {
		workspaceId: string;
		limitPerMinute: number;
		now?: Date;
	}): RenderRateLimitResult | Promise<RenderRateLimitResult>;
};
