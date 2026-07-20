export type WorkspaceTier = "trial" | "starter" | "pro" | "business";
export type RenderStatus = "processing" | "completed" | "failed";

export type NewRenderRecord = {
	id?: string;
	workspaceId: string;
	documentType: string;
	template: string;
	schemaVersion: string;
	status: RenderStatus;
	payloadHash: string;
	resolvedTier: WorkspaceTier;
	showWatermark: boolean;
	idempotencyHash?: string | null;
	r2Key?: string | null;
	sha256?: string | null;
	byteSize?: number | null;
	shareToken?: string | null;
	shareExpiresAt?: Date | null;
	logoChecksum?: string | null;
	brandingSnapshot?: unknown;
	errorCode?: string | null;
};

export type RenderRecord = NewRenderRecord & {
	id: string;
	createdAt: Date;
	updatedAt: Date;
};
