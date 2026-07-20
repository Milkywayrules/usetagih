import { date, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { organization } from "./better-auth.js";

export const usageCounters = pgTable(
	"usage_counters",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		month: date("month").notNull(),
		renderCount: integer("render_count").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.workspaceId, table.month] })],
);

export type UsageCounter = typeof usageCounters.$inferSelect;
export type NewUsageCounter = typeof usageCounters.$inferInsert;
