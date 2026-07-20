import type { AuditAppendInput, AuditRepo } from "@usetagih/core";
import type { Db } from "../client.js";
import {
	AUDIT_ACTIONS_NULLABLE_WORKSPACE,
	auditEvents,
} from "../schema/audit-events.js";

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
	};
}
