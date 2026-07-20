/**
 * IdempotencyStore adapter tests — require compose Postgres with migrations applied.
 * Skipped when DATABASE_URL is unreachable (see describe.skipIf guard).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { organization, user } from "../schema/better-auth.js";
import { idempotencyKeys } from "../schema/idempotency-keys.js";
import { workspaceSettings } from "../schema/workspace-settings.js";
import { createIdempotencyStore } from "./idempotency-store.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("createIdempotencyStore", () => {
	const { db, sql } = createDb(dbUrl);
	const store = createIdempotencyStore(db);

	let orgAId: string;
	let orgBId: string;

	beforeAll(async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const actorUserId = crypto.randomUUID();

		await db.insert(user).values({
			id: actorUserId,
			name: "Idempotency Store User",
			email: `idempotency-store-${suffix}@example.com`,
			emailVerified: true,
		});

		orgAId = crypto.randomUUID();
		orgBId = crypto.randomUUID();

		await db.insert(organization).values([
			{
				id: orgAId,
				name: "Idempotency Org A",
				slug: `idempotency-a-${suffix}`,
				createdAt: new Date(),
			},
			{
				id: orgBId,
				name: "Idempotency Org B",
				slug: `idempotency-b-${suffix}`,
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

	test("lookup returns miss when no row exists", async () => {
		const result = await store.lookup({
			workspaceId: orgAId,
			endpoint: "POST /v1/invoices/render",
			keyHash: `missing-${crypto.randomUUID()}`,
		});
		expect(result).toEqual({ status: "miss" });
	});

	test("store then lookup returns hit with response body", async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const endpoint = "POST /v1/invoices/render";
		const keyHash = `store-hit-${suffix}`;
		const requestHash = `req-${suffix}`;
		const responseBody = {
			renderId: `rnd_${suffix}`,
			shareUrl: "https://example.com/share/token",
		};
		const expiresAt = new Date(Date.now() + 86_400_000);

		await store.store({
			workspaceId: orgAId,
			endpoint,
			keyHash,
			requestHash,
			responseBody,
			expiresAt,
		});

		const lookup = await store.lookup({
			workspaceId: orgAId,
			endpoint,
			keyHash,
		});
		expect(lookup.status).toBe("hit");
		if (lookup.status === "hit") {
			expect(lookup.requestHash).toBe(requestHash);
			expect(lookup.responseBody).toEqual(responseBody);
		}
	});

	test("expired rows are ignored on lookup", async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const endpoint = "POST /v1/quotations/render";
		const keyHash = `expired-${suffix}`;

		await db.insert(idempotencyKeys).values({
			workspaceId: orgAId,
			endpoint,
			keyHash,
			requestHash: `req-expired-${suffix}`,
			responseBody: { ok: true },
			expiresAt: new Date(Date.now() - 60_000),
		});

		const lookup = await store.lookup({
			workspaceId: orgAId,
			endpoint,
			keyHash,
		});
		expect(lookup).toEqual({ status: "miss" });
	});

	test("same key hash in different workspaces are isolated", async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const endpoint = "POST /v1/receipts/render";
		const keyHash = `shared-${suffix}`;
		const expiresAt = new Date(Date.now() + 86_400_000);

		await store.store({
			workspaceId: orgAId,
			endpoint,
			keyHash,
			requestHash: `req-a-${suffix}`,
			responseBody: { renderId: "rnd_a" },
			expiresAt,
		});

		const lookupB = await store.lookup({
			workspaceId: orgBId,
			endpoint,
			keyHash,
		});
		expect(lookupB).toEqual({ status: "miss" });
	});

	test("store ignores unique violation on concurrent insert race", async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const endpoint = "POST /v1/invoices/render";
		const keyHash = `race-${suffix}`;
		const expiresAt = new Date(Date.now() + 86_400_000);
		const params = {
			workspaceId: orgAId,
			endpoint,
			keyHash,
			requestHash: `req-race-${suffix}`,
			responseBody: { renderId: "rnd_race" },
			expiresAt,
		};

		await Promise.all([store.store(params), store.store(params)]);

		const lookup = await store.lookup({
			workspaceId: orgAId,
			endpoint,
			keyHash,
		});
		expect(lookup.status).toBe("hit");
	});
});
