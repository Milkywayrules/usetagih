import { sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./better-auth.js";

/** Nullable workspace_id allowed only for signup, login, workspace.bootstrap (app layer). */
export const AUDIT_ACTIONS_NULLABLE_WORKSPACE = [
	"signup",
	"login",
	"workspace.bootstrap",
] as const;

export const auditEvents = pgTable(
	"audit_events",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		workspaceId: uuid("workspace_id").references(() => organization.id, {
			onDelete: "set null",
		}),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		action: text("action").notNull(),
		resourceType: text("resource_type"),
		resourceId: text("resource_id"),
		outcome: text("outcome").notNull(),
		ip: text("ip"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("audit_events_workspace_id_created_at_idx").on(
			table.workspaceId,
			table.createdAt,
		),
		index("audit_events_user_id_created_at_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
