import type { UsageCounterRepo } from "../ports/usage-counter-repo.js";

type CounterKey = `${string}:${string}`;

export function createInMemoryUsageCounterRepo(): UsageCounterRepo {
	const counters = new Map<CounterKey, number>();

	function key(workspaceId: string, month: string): CounterKey {
		return `${workspaceId}:${month}`;
	}

	return {
		async getRenderCount({ workspaceId, month }) {
			return counters.get(key(workspaceId, month)) ?? 0;
		},
		async tryIncrementRenderCount({ workspaceId, month, limit }) {
			const counterKey = key(workspaceId, month);
			const current = counters.get(counterKey) ?? 0;
			if (current >= limit) {
				return { ok: false, count: current };
			}
			const next = current + 1;
			counters.set(counterKey, next);
			return { ok: true, count: next };
		},
	};
}
