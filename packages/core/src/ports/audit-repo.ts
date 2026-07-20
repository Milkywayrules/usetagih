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

export interface AuditRepo {
	append(input: AuditAppendInput): Promise<{ id: string }>;
}
