/**
 * UsageCounterRepo tests — require compose Postgres with migrations applied.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { currentUsageMonth } from "@usetagih/core";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { organization } from "../schema/better-auth.js";
import { usageCounters } from "../schema/usage-counters.js";
import { createUsageCounterRepo } from "./usage-counter-repo.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("UsageCounterRepo", () => {
	const { db, sql } = createDb(dbUrl);
	const usageCounterRepo = createUsageCounterRepo(db);
	const month = currentUsageMonth(new Date("2026-07-20T00:00:00.000Z"));

	let workspaceId: string;

	beforeAll(async () => {
		workspaceId = crypto.randomUUID();
		const suffix = crypto.randomUUID().slice(0, 8);
		await db.insert(organization).values({
			id: workspaceId,
			name: "Usage Counter Org",
			slug: `usage-counter-${suffix}`,
			createdAt: new Date(),
		});
	});

	afterAll(async () => {
		await db
			.delete(usageCounters)
			.where(eq(usageCounters.workspaceId, workspaceId));
		await db.delete(organization).where(eq(organization.id, workspaceId));
		await sql.end({ timeout: 1 });
	});

	test("increments render count up to limit", async () => {
		expect(await usageCounterRepo.getRenderCount({ workspaceId, month })).toBe(
			0,
		);

		const first = await usageCounterRepo.tryIncrementRenderCount({
			workspaceId,
			month,
			limit: 2,
		});
		expect(first.ok).toBe(true);
		if (first.ok) {
			expect(first.count).toBe(1);
		}

		const second = await usageCounterRepo.tryIncrementRenderCount({
			workspaceId,
			month,
			limit: 2,
		});
		expect(second.ok).toBe(true);
		if (second.ok) {
			expect(second.count).toBe(2);
		}

		const third = await usageCounterRepo.tryIncrementRenderCount({
			workspaceId,
			month,
			limit: 2,
		});
		expect(third.ok).toBe(false);
		expect(await usageCounterRepo.getRenderCount({ workspaceId, month })).toBe(
			2,
		);
	});
});
