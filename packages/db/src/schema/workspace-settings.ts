import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./better-auth.js";
import { workspaceTierEnum } from "./enums.js";

export const workspaceSettings = pgTable("workspace_settings", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	tier: workspaceTierEnum("tier").notNull().default("trial"),
	branding: jsonb("branding"),
	businessIdentity: jsonb("business_identity"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type NewWorkspaceSettings = typeof workspaceSettings.$inferInsert;
