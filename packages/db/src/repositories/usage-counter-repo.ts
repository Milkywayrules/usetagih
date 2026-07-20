import type { UsageCounterRepo } from "@usetagih/core";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../client.js";
import { usageCounters } from "../schema/usage-counters.js";

export function createUsageCounterRepo(db: Db): UsageCounterRepo {
	return {
		async getRenderCount({ workspaceId, month }) {
			const rows = await db
				.select({ renderCount: usageCounters.renderCount })
				.from(usageCounters)
				.where(
					and(
						eq(usageCounters.workspaceId, workspaceId),
						eq(usageCounters.month, month),
					),
				)
				.limit(1);

			return rows[0]?.renderCount ?? 0;
		},

		async tryIncrementRenderCount({ workspaceId, month, limit }) {
			const updated = await db
				.update(usageCounters)
				.set({
					renderCount: sql`${usageCounters.renderCount} + 1`,
				})
				.where(
					and(
						eq(usageCounters.workspaceId, workspaceId),
						eq(usageCounters.month, month),
						sql`${usageCounters.renderCount} < ${limit}`,
					),
				)
				.returning({ renderCount: usageCounters.renderCount });

			if (updated[0]) {
				return { ok: true, count: updated[0].renderCount };
			}

			const inserted = await db
				.insert(usageCounters)
				.values({
					workspaceId,
					month,
					renderCount: 1,
				})
				.onConflictDoUpdate({
					target: [usageCounters.workspaceId, usageCounters.month],
					set: {
						renderCount: sql`${usageCounters.renderCount} + 1`,
					},
					where: sql`${usageCounters.renderCount} < ${limit}`,
				})
				.returning({ renderCount: usageCounters.renderCount });

			if (inserted[0]) {
				return { ok: true, count: inserted[0].renderCount };
			}

			const current = await this.getRenderCount({ workspaceId, month });
			return { ok: false, count: current };
		},
	};
}
