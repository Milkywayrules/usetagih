import type {
	AuditAppendInput,
	AuditEventRecord,
	AuditListQuery,
	AuditRepo,
} from "@usetagih/core";
import { and, count, desc, eq, gte } from "drizzle-orm";
import type { Db } from "../client.js";
import {
	AUDIT_ACTIONS_NULLABLE_WORKSPACE,
	type AuditEvent,
	auditEvents,
} from "../schema/audit-events.js";

function mapAuditRow(row: AuditEvent): AuditEventRecord {
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		userId: row.userId,
		action: row.action,
		resourceType: row.resourceType,
		resourceId: row.resourceId,
		outcome: row.outcome as AuditEventRecord["outcome"],
		ip: row.ip,
		metadata: (row.metadata as Record<string, unknown> | null) ?? null,
		createdAt: row.createdAt,
	};
}

export function createAuditRepo(db: Db): AuditRepo {
	return {
		async append(input: AuditAppendInput) {
			if (
				input.workspaceId === null &&
				!AUDIT_ACTIONS_NULLABLE_WORKSPACE.includes(
					input.action as (typeof AUDIT_ACTIONS_NULLABLE_WORKSPACE)[number],
				)
			) {
				throw new Error(`workspaceId required for action ${input.action}`);
			}

			const [row] = await db
				.insert(auditEvents)
				.values({
					workspaceId: input.workspaceId,
					userId: input.userId,
					action: input.action,
					resourceType: input.resourceType ?? null,
					resourceId: input.resourceId ?? null,
					outcome: input.outcome,
					ip: input.ip ?? null,
					metadata: input.metadata ?? null,
				})
				.returning({ id: auditEvents.id });

			if (!row) {
				throw new Error("audit insert returned no row");
			}

			return { id: row.id };
		},

		async listByWorkspacePaginated(workspaceId: string, query: AuditListQuery) {
			const where = and(
				eq(auditEvents.workspaceId, workspaceId),
				gte(auditEvents.createdAt, query.since),
			);

			const [countRow] = await db
				.select({ total: count() })
				.from(auditEvents)
				.where(where);

			const items = await db
				.select()
				.from(auditEvents)
				.where(where)
				.orderBy(desc(auditEvents.createdAt))
				.limit(query.limit)
				.offset(query.offset);

			return {
				items: items.map(mapAuditRow),
				total: Number(countRow?.total ?? 0),
			};
		},
	};
}
