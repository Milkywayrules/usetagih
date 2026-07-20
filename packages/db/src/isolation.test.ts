/**
 * Tenant isolation probes beyond render repo — require compose Postgres + migrations.
 * Skipped when DATABASE_URL is unreachable.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "./client.js";
import { AUDIT_ACTIONS_NULLABLE_WORKSPACE } from "./schema/audit-events.js";
import { organization, user } from "./schema/better-auth.js";
import { idempotencyKeys } from "./schema/idempotency-keys.js";
import { workspaceSettings } from "./schema/workspace-settings.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("tenant isolation probes", () => {
	const { db, sql } = createDb(dbUrl);

	let orgAId: string;
	let orgBId: string;
	let actorUserId: string;

	beforeAll(async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		actorUserId = crypto.randomUUID();

		await db.insert(user).values({
			id: actorUserId,
			name: "Isolation Probe User",
			email: `isolation-probe-${suffix}@example.com`,
			emailVerified: true,
		});

		orgAId = crypto.randomUUID();
		orgBId = crypto.randomUUID();

		await db.insert(organization).values([
			{
				id: orgAId,
				name: "Probe Org A",
				slug: `probe-a-${suffix}`,
				createdAt: new Date(),
			},
			{
				id: orgBId,
				name: "Probe Org B",
				slug: `probe-b-${suffix}`,
				createdAt: new Date(),
			},
		]);

		await db.insert(workspaceSettings).values([
			{ organizationId: orgAId, tier: "trial" },
			{ organizationId: orgBId, tier: "pro" },
		]);
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

	test("idempotency_keys unique constraint is scoped per workspace", async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const endpoint = "POST /v1/invoices/render";
		const keyHash = `shared-key-${suffix}`;
		const expiresAt = new Date(Date.now() + 86_400_000);
		const responseBody = { ok: true };

		await db
			.insert(idempotencyKeys)
			.values([
				{
					workspaceId: orgAId,
					endpoint,
					keyHash,
					requestHash: `req-a-${suffix}`,
					responseBody,
					expiresAt,
				},
				{
					workspaceId: orgBId,
					endpoint,
					keyHash,
					requestHash: `req-b-${suffix}`,
					responseBody,
					expiresAt,
				},
			])
			.returning();

		let duplicateRejected = false;
		try {
			await db
				.insert(idempotencyKeys)
				.values({
					workspaceId: orgAId,
					endpoint,
					keyHash,
					requestHash: `req-a-dup-${suffix}`,
					responseBody,
					expiresAt,
				})
				.returning();
		} catch {
			duplicateRejected = true;
		}
		expect(duplicateRejected).toBe(true);
	});

	test("audit bootstrap actions constant matches documented null-workspace allowlist", () => {
		expect(AUDIT_ACTIONS_NULLABLE_WORKSPACE).toEqual([
			"signup",
			"login",
			"workspace.bootstrap",
		]);
	});
});
