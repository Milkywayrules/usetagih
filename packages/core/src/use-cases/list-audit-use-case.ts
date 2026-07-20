import type { AuditRepo } from "../ports/index.js";

export const DEFAULT_AUDIT_PAGE_SIZE = 20;
export const MAX_AUDIT_PAGE_SIZE = 100;
export const AUDIT_RETENTION_DAYS = 90;

export type AuditEventMetadata = {
	id: string;
	action: string;
	resourceType: string | null;
	resourceId: string | null;
	outcome: "success" | "failure";
	actorUserId: string;
	ip: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
};

export type ListAuditUseCaseInput = {
	workspaceId: string;
	page?: number;
	pageSize?: number;
	now?: Date;
};

export type ListAuditUseCaseResult = {
	events: AuditEventMetadata[];
	page: number;
	pageSize: number;
	total: number;
};

function retentionSince(now: Date): Date {
	const since = new Date(now);
	since.setUTCDate(since.getUTCDate() - AUDIT_RETENTION_DAYS);
	return since;
}

export function mapAuditEventRecord(record: {
	id: string;
	userId: string;
	action: string;
	resourceType: string | null;
	resourceId: string | null;
	outcome: "success" | "failure";
	ip: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
}): AuditEventMetadata {
	return {
		id: record.id,
		action: record.action,
		resourceType: record.resourceType,
		resourceId: record.resourceId,
		outcome: record.outcome,
		actorUserId: record.userId,
		ip: record.ip,
		metadata: record.metadata,
		createdAt: record.createdAt.toISOString(),
	};
}

export async function listAuditUseCase(
	input: ListAuditUseCaseInput,
	auditRepo: AuditRepo,
): Promise<ListAuditUseCaseResult> {
	const page = Math.max(1, input.page ?? 1);
	const pageSize = Math.min(
		MAX_AUDIT_PAGE_SIZE,
		Math.max(1, input.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE),
	);
	const offset = (page - 1) * pageSize;
	const now = input.now ?? new Date();

	const { items, total } = await auditRepo.listByWorkspacePaginated(
		input.workspaceId,
		{
			limit: pageSize,
			offset,
			since: retentionSince(now),
		},
	);

	return {
		events: items.map(mapAuditEventRecord),
		page,
		pageSize,
		total,
	};
}
