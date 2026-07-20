import type {
	ApiKeyCreateInput,
	ApiKeyRecord,
	ApiKeyRepo,
} from "@usetagih/core";
import type { ApiScope } from "@usetagih/schema";
import {
	generateApiKeySecret,
	hashApiKeySecret,
} from "../auth/api-key-crypto.js";

type StoredApiKey = ApiKeyRecord & { keyHash: string };

export function createInMemoryApiKeyRepo(): ApiKeyRepo & {
	/** Test-only access to stored rows including keyHash. */
	_store: Map<string, StoredApiKey>;
} {
	const byId = new Map<string, StoredApiKey>();
	const byPrefix = new Map<string, string[]>();

	return {
		_store: byId,

		async create(input: ApiKeyCreateInput) {
			const id = crypto.randomUUID();
			const record: StoredApiKey = {
				id,
				workspaceId: input.workspaceId,
				name: input.name,
				prefix: input.prefix,
				scopes: input.scopes,
				expiresAt: input.expiresAt ?? null,
				revokedAt: null,
				createdAt: new Date(),
				keyHash: input.keyHash,
			};
			byId.set(id, record);
			const prefixIds = byPrefix.get(input.prefix) ?? [];
			prefixIds.push(id);
			byPrefix.set(input.prefix, prefixIds);
			const { keyHash: _ignored, ...publicRecord } = record;
			return publicRecord;
		},

		async listByWorkspace(workspaceId: string) {
			return [...byId.values()]
				.filter((row) => row.workspaceId === workspaceId)
				.map(({ keyHash: _ignored, ...record }) => record);
		},

		async findByPrefix(prefix: string) {
			const ids = byPrefix.get(prefix) ?? [];
			const row = ids.map((id) => byId.get(id)).find(Boolean);
			return row ?? null;
		},

		async findById(workspaceId: string, id: string) {
			const row = byId.get(id);
			if (!row || row.workspaceId !== workspaceId) {
				return null;
			}
			const { keyHash: _ignored, ...record } = row;
			return record;
		},

		async revoke(workspaceId: string, id: string) {
			const row = byId.get(id);
			if (!row || row.workspaceId !== workspaceId) {
				return null;
			}
			if (row.revokedAt) {
				const { keyHash: _ignored, ...record } = row;
				return record;
			}
			row.revokedAt = new Date();
			const { keyHash: _ignored, ...record } = row;
			return record;
		},
	};
}

export async function createTestApiKey(
	repo: ApiKeyRepo,
	options: {
		workspaceId: string;
		scopes: ApiScope[];
		name?: string;
		expiresAt?: Date | null;
	},
): Promise<{ secret: string; record: ApiKeyRecord }> {
	const { secret, prefix } = generateApiKeySecret();
	const keyHash = await hashApiKeySecret(secret);
	const record = await repo.create({
		workspaceId: options.workspaceId,
		name: options.name ?? "Test key",
		prefix,
		keyHash,
		scopes: options.scopes,
		expiresAt: options.expiresAt ?? null,
	});
	return { secret, record };
}
