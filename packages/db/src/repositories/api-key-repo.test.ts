/**
 * ApiKeyRepo tests — require compose Postgres with migrations applied.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { API_SCOPES } from "@usetagih/schema";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { apiKeys } from "../schema/api-keys.js";
import { organization, user } from "../schema/better-auth.js";
import { workspaceSettings } from "../schema/workspace-settings.js";
import { createApiKeyRepo } from "./api-key-repo.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("ApiKeyRepo", () => {
	const { db, sql } = createDb(dbUrl);
	const apiKeyRepo = createApiKeyRepo(db);

	let orgAId: string;
	let orgBId: string;

	beforeAll(async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const actorUserId = crypto.randomUUID();

		await db.insert(user).values({
			id: actorUserId,
			name: "Api Key Test User",
			email: `api-key-${suffix}@example.com`,
			emailVerified: true,
		});

		orgAId = crypto.randomUUID();
		orgBId = crypto.randomUUID();

		await db.insert(organization).values([
			{
				id: orgAId,
				name: "Key Org A",
				slug: `key-org-a-${suffix}`,
				createdAt: new Date(),
			},
			{
				id: orgBId,
				name: "Key Org B",
				slug: `key-org-b-${suffix}`,
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

	test("create stores hash-at-rest, not plaintext secret", async () => {
		const secret = "utk_live_testsecretvalue123456789012345678901234";
		const prefix = secret.slice(0, 16);
		const record = await apiKeyRepo.create({
			workspaceId: orgAId,
			name: "Hash proof",
			prefix,
			keyHash: "$argon2id$v=19$m=19456,t=2,p=1$fakehash",
			scopes: ["audit:read"],
		});

		const [row] = await db
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.id, record.id));

		expect(row?.keyHash).not.toBe(secret);
		expect(row?.keyHash.includes(secret)).toBe(false);
		expect(row?.prefix).toBe(prefix);
		expect(row?.prefix).not.toBe(secret);
	});

	test("listByWorkspace returns only workspace keys", async () => {
		const keyA = await apiKeyRepo.create({
			workspaceId: orgAId,
			name: "A key",
			prefix: "utk_live_listaaa",
			keyHash: "hash-a",
			scopes: ["audit:read"],
		});
		await apiKeyRepo.create({
			workspaceId: orgBId,
			name: "B key",
			prefix: "utk_live_listbbb",
			keyHash: "hash-b",
			scopes: ["audit:read"],
		});

		const listA = await apiKeyRepo.listByWorkspace(orgAId);
		expect(listA.some((k) => k.id === keyA.id)).toBe(true);
		expect(listA.every((k) => k.workspaceId === orgAId)).toBe(true);
	});

	test("findByPrefix returns all rows with keyHash", async () => {
		const prefix = "utk_live_findme12";
		await apiKeyRepo.create({
			workspaceId: orgAId,
			name: "Find me",
			prefix,
			keyHash: "hash-find",
			scopes: ["renders:read"],
		});
		await apiKeyRepo.create({
			workspaceId: orgAId,
			name: "Find me too",
			prefix,
			keyHash: "hash-find-2",
			scopes: ["audit:read"],
		});

		const found = await apiKeyRepo.findByPrefix(prefix);
		expect(found).toHaveLength(2);
		expect(found.every((row) => row.prefix === prefix)).toBe(true);
		expect(found.map((row) => row.keyHash).sort()).toEqual([
			"hash-find",
			"hash-find-2",
		]);
	});

	test("findById and revoke enforce workspace isolation", async () => {
		const key = await apiKeyRepo.create({
			workspaceId: orgAId,
			name: "Isolated",
			prefix: "utk_live_isolate1",
			keyHash: "hash-iso",
			scopes: [...API_SCOPES],
		});

		expect(await apiKeyRepo.findById(orgBId, key.id)).toBeNull();
		expect(await apiKeyRepo.revoke(orgBId, key.id)).toBeNull();

		const revoked = await apiKeyRepo.revoke(orgAId, key.id);
		expect(revoked?.revokedAt).toBeInstanceOf(Date);

		const idempotent = await apiKeyRepo.revoke(orgAId, key.id);
		expect(idempotent?.revokedAt?.toISOString()).toBe(
			revoked?.revokedAt?.toISOString(),
		);
	});
});
