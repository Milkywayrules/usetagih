/**
 * WorkspaceSettingsRepo tests — require compose Postgres with migrations applied.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS } from "@usetagih/config/env";
import { eq } from "drizzle-orm";
import { createDb, probeDb } from "../client.js";
import { organization } from "../schema/better-auth.js";
import { workspaceSettings } from "../schema/workspace-settings.js";
import { createWorkspaceSettingsRepo } from "./workspace-settings-repo.js";

const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;

try {
	dbAvailable = await probeDb(dbUrl);
} catch {
	dbAvailable = false;
}

describe.skipIf(!dbAvailable)("WorkspaceSettingsRepo", () => {
	const { db, sql } = createDb(dbUrl);
	const repo = createWorkspaceSettingsRepo(db);

	let workspaceId: string;

	beforeAll(async () => {
		workspaceId = crypto.randomUUID();
		const suffix = crypto.randomUUID().slice(0, 8);
		await db.insert(organization).values({
			id: workspaceId,
			name: "Settings Org",
			slug: `settings-${suffix}`,
			createdAt: new Date(),
		});
		await db.insert(workspaceSettings).values({
			organizationId: workspaceId,
			tier: "trial",
		});
	});

	afterAll(async () => {
		await db
			.delete(workspaceSettings)
			.where(eq(workspaceSettings.organizationId, workspaceId));
		await db.delete(organization).where(eq(organization.id, workspaceId));
		await sql.end({ timeout: 1 });
	});

	test("updateBusinessIdentity merges partial patches", async () => {
		await repo.updateBusinessIdentity(workspaceId, { name: "Acme" });
		const second = await repo.updateBusinessIdentity(workspaceId, {
			email: "hello@acme.example",
		});

		expect(second.name).toBe("Acme");
		expect(second.email).toBe("hello@acme.example");
	});

	test("updateBranding merges accent color and logoUrl", async () => {
		await repo.updateBranding(workspaceId, { accentColor: "#112233" });
		const branding = await repo.updateBranding(workspaceId, {
			logoUrl: "https://cdn.example/logo.png",
		});

		expect(branding.accentColor).toBe("#112233");
		expect(branding.logoUrl).toBe("https://cdn.example/logo.png");
	});
});
