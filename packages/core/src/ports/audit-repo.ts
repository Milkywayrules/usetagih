export type AuditAppendInput = {
	workspaceId: string | null;
	userId: string;
	action: string;
	resourceType?: string | null;
	resourceId?: string | null;
	outcome: "success" | "failure";
	ip?: string | null;
	metadata?: Record<string, unknown> | null;
};

export type AuditEventRecord = {
	id: string;
	workspaceId: string | null;
	userId: string;
	action: string;
	resourceType: string | null;
	resourceId: string | null;
	outcome: "success" | "failure";
	ip: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
};

export type AuditListQuery = {
	limit: number;
	offset: number;
	since: Date;
};

export type AuditListPage = {
	items: AuditEventRecord[];
	total: number;
};

export interface AuditRepo {
	append(input: AuditAppendInput): Promise<{ id: string }>;
	listByWorkspacePaginated(
		workspaceId: string,
		query: AuditListQuery,
	): Promise<AuditListPage>;
}
