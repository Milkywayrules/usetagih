import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./better-auth.js";

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		prefix: text("prefix").notNull(),
		keyHash: text("key_hash").notNull(),
		scopes: text("scopes").array().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("api_keys_workspace_id_idx").on(table.workspaceId),
		index("api_keys_workspace_id_revoked_at_idx").on(
			table.workspaceId,
			table.revokedAt,
		),
	],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
