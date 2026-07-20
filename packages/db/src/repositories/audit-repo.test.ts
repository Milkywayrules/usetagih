/**
 * AuditRepo tests — require compose Postgres with migrations applied.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { auditEvents } from "../schema/audit-events.js";
import { organization, user } from "../schema/better-auth.js";
import { createAuditRepo } from "./audit-repo.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("AuditRepo", () => {
	const { db, sql } = createDb(dbUrl);
	const auditRepo = createAuditRepo(db);

	let workspaceId: string;
	let actorUserId: string;

	beforeAll(async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		actorUserId = crypto.randomUUID();
		workspaceId = crypto.randomUUID();

		await db.insert(user).values({
			id: actorUserId,
			name: "Audit Test User",
			email: `audit-${suffix}@example.com`,
			emailVerified: true,
		});

		await db.insert(organization).values({
			id: workspaceId,
			name: "Audit Org",
			slug: `audit-org-${suffix}`,
			createdAt: new Date(),
		});
	});

	afterAll(async () => {
		await db
			.delete(auditEvents)
			.where(eq(auditEvents.workspaceId, workspaceId));
		await db.delete(organization).where(eq(organization.id, workspaceId));
		await db.delete(user).where(eq(user.id, actorUserId));
		await sql.end({ timeout: 1 });
	});

	test("append and listByWorkspacePaginated return workspace-scoped rows", async () => {
		const otherWorkspaceId = crypto.randomUUID();
		const suffix = crypto.randomUUID().slice(0, 8);

		await db.insert(organization).values({
			id: otherWorkspaceId,
			name: "Other Audit Org",
			slug: `audit-other-${suffix}`,
			createdAt: new Date(),
		});

		try {
			await auditRepo.append({
				workspaceId,
				userId: actorUserId,
				action: "validate",
				resourceType: "document",
				resourceId: "invoice",
				outcome: "success",
				ip: "127.0.0.1",
			});
			await auditRepo.append({
				workspaceId: otherWorkspaceId,
				userId: actorUserId,
				action: "render",
				resourceType: "render",
				resourceId: "rnd_other",
				outcome: "success",
			});

			const since = new Date();
			since.setUTCDate(since.getUTCDate() - 90);

			const page = await auditRepo.listByWorkspacePaginated(workspaceId, {
				limit: 10,
				offset: 0,
				since,
			});

			expect(page.total).toBeGreaterThanOrEqual(1);
			expect(page.items.every((row) => row.workspaceId === workspaceId)).toBe(
				true,
			);
			expect(page.items.some((row) => row.action === "validate")).toBe(true);
			expect(page.items.some((row) => row.action === "render")).toBe(false);
		} finally {
			await db
				.delete(auditEvents)
				.where(eq(auditEvents.workspaceId, otherWorkspaceId));
			await db
				.delete(organization)
				.where(eq(organization.id, otherWorkspaceId));
		}
	});

	test("repo surface is append-only at MVP", () => {
		expect(typeof auditRepo.append).toBe("function");
		expect(typeof auditRepo.listByWorkspacePaginated).toBe("function");
		expect("delete" in auditRepo).toBe(false);
	});
});
