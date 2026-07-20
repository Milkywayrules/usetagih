import { sql } from "drizzle-orm";
import {
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./better-auth.js";

export const idempotencyKeys = pgTable(
	"idempotency_keys",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		endpoint: text("endpoint").notNull(),
		keyHash: text("key_hash").notNull(),
		requestHash: text("request_hash").notNull(),
		responseBody: jsonb("response_body").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("idempotency_keys_workspace_endpoint_key_hash_uidx").on(
			table.workspaceId,
			table.endpoint,
			table.keyHash,
		),
	],
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
