/**
 * Cross-workspace isolation tests — require compose Postgres with migrations applied.
 * Skipped when DATABASE_URL is unreachable (see describe.skipIf guard).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { organization, user } from "../schema/better-auth.js";
import { workspaceSettings } from "../schema/workspace-settings.js";
import { createRenderRepo } from "./render-repo.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("workspace isolation", () => {
	const { db, sql } = createDb(dbUrl);
	const renderRepo = createRenderRepo(db);

	let orgAId: string;
	let orgBId: string;
	let renderAId: string;
	let renderBId: string;

	beforeAll(async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const actorUserId = crypto.randomUUID();

		await db.insert(user).values({
			id: actorUserId,
			name: "Isolation Test User",
			email: `isolation-${suffix}@example.com`,
			emailVerified: true,
		});

		orgAId = crypto.randomUUID();
		orgBId = crypto.randomUUID();

		await db.insert(organization).values([
			{
				id: orgAId,
				name: "Org A",
				slug: `org-a-${suffix}`,
				createdAt: new Date(),
			},
			{
				id: orgBId,
				name: "Org B",
				slug: `org-b-${suffix}`,
				createdAt: new Date(),
			},
		]);

		await db.insert(workspaceSettings).values([
			{ organizationId: orgAId, tier: "trial" },
			{ organizationId: orgBId, tier: "pro" },
		]);

		const renderA = await renderRepo.insert({
			workspaceId: orgAId,
			documentType: "invoice",
			template: "modern",
			schemaVersion: "2026-07-20",
			status: "completed",
			payloadHash: `hash-a-${suffix}`,
			resolvedTier: "trial",
			showWatermark: true,
		});
		renderAId = renderA.id;

		const renderB = await renderRepo.insert({
			workspaceId: orgBId,
			documentType: "quotation",
			template: "classic",
			schemaVersion: "2026-07-20",
			status: "completed",
			payloadHash: `hash-b-${suffix}`,
			resolvedTier: "pro",
			showWatermark: false,
		});
		renderBId = renderB.id;
	});

	afterAll(async () => {
		if (orgAId) {
			await db.delete(organization).where(eq(organization.id, orgAId));
		}
		if (orgBId) {
			await db.delete(organization).where(eq(organization.id, orgBId));
		}
		await sql.end({ timeout: 5 });
	});

	test("getByIdAndWorkspace returns null for cross-workspace lookup", async () => {
		const cross = await renderRepo.getByIdAndWorkspace(renderAId, orgBId);
		expect(cross).toBeNull();
	});

	test("listByWorkspace returns only workspace-scoped renders", async () => {
		const listA = await renderRepo.listByWorkspace(orgAId);
		const listB = await renderRepo.listByWorkspace(orgBId);

		expect(listA.some((r) => r.id === renderAId)).toBe(true);
		expect(listA.some((r) => r.id === renderBId)).toBe(false);

		expect(listB.some((r) => r.id === renderBId)).toBe(true);
		expect(listB.some((r) => r.id === renderAId)).toBe(false);
	});
});
