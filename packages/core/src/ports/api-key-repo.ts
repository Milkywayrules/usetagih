import type { ApiScope } from "@usetagih/schema";

export type ApiKeyRecord = {
	id: string;
	workspaceId: string;
	name: string;
	prefix: string;
	scopes: ApiScope[];
	expiresAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
};

export type ApiKeyCreateInput = {
	workspaceId: string;
	name: string;
	prefix: string;
	keyHash: string;
	scopes: ApiScope[];
	expiresAt?: Date | null;
};

export interface ApiKeyRepo {
	create(input: ApiKeyCreateInput): Promise<ApiKeyRecord>;
	listByWorkspace(workspaceId: string): Promise<ApiKeyRecord[]>;
	findByPrefix(
		prefix: string,
	): Promise<(ApiKeyRecord & { keyHash: string }) | null>;
	findById(workspaceId: string, id: string): Promise<ApiKeyRecord | null>;
	revoke(workspaceId: string, id: string): Promise<ApiKeyRecord | null>;
}
