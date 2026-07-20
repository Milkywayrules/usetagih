export type UsageCounterRepo = {
	getRenderCount(input: {
		workspaceId: string;
		month: string;
	}): Promise<number>;
	tryIncrementRenderCount(input: {
		workspaceId: string;
		month: string;
		limit: number;
	}): Promise<{ ok: true; count: number } | { ok: false; count: number }>;
};
