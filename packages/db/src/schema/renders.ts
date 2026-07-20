import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./better-auth.js";
import { renderStatusEnum, workspaceTierEnum } from "./enums.js";

export const renders = pgTable(
	"renders",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		documentType: text("document_type").notNull(),
		template: text("template").notNull(),
		schemaVersion: text("schema_version").notNull(),
		status: renderStatusEnum("status").notNull(),
		idempotencyHash: text("idempotency_hash"),
		payloadHash: text("payload_hash").notNull(),
		r2Key: text("r2_key"),
		sha256: text("sha256"),
		byteSize: bigint("byte_size", { mode: "number" }),
		shareToken: text("share_token"),
		shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
		logoChecksum: text("logo_checksum"),
		resolvedTier: workspaceTierEnum("resolved_tier").notNull(),
		showWatermark: boolean("show_watermark").notNull(),
		brandingSnapshot: jsonb("branding_snapshot"),
		errorCode: text("error_code"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("renders_workspace_id_idx").on(table.workspaceId),
		index("renders_workspace_id_created_at_idx").on(
			table.workspaceId,
			table.createdAt,
		),
		uniqueIndex("renders_workspace_id_idempotency_hash_uidx")
			.on(table.workspaceId, table.idempotencyHash)
			.where(sql`${table.idempotencyHash} IS NOT NULL`),
	],
);

export type Render = typeof renders.$inferSelect;
export type NewRender = typeof renders.$inferInsert;
