import type {
	AuditAppendInput,
	AuditEventRecord,
	AuditListQuery,
	AuditRepo,
} from "@usetagih/core";

export function createInMemoryAuditRepo(): AuditRepo & {
	events: AuditEventRecord[];
} {
	const events: AuditEventRecord[] = [];

	return {
		events,

		async append(input: AuditAppendInput) {
			const row: AuditEventRecord = {
				id: crypto.randomUUID(),
				workspaceId: input.workspaceId,
				userId: input.userId,
				action: input.action,
				resourceType: input.resourceType ?? null,
				resourceId: input.resourceId ?? null,
				outcome: input.outcome,
				ip: input.ip ?? null,
				metadata: input.metadata ?? null,
				createdAt: new Date(),
			};
			events.push(row);
			return { id: row.id };
		},

		async listByWorkspacePaginated(workspaceId: string, query: AuditListQuery) {
			const filtered = events
				.filter(
					(event) =>
						event.workspaceId === workspaceId && event.createdAt >= query.since,
				)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

			return {
				items: filtered.slice(query.offset, query.offset + query.limit),
				total: filtered.length,
			};
		},
	};
}

export function createNoopAuditRepo(): AuditRepo {
	return {
		async append() {
			return { id: crypto.randomUUID() };
		},
		async listByWorkspacePaginated() {
			return { items: [], total: 0 };
		},
	};
}
