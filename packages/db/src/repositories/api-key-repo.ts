import type {
	ApiKeyCreateInput,
	ApiKeyRecord,
	ApiKeyRepo,
} from "@usetagih/core";
import { ApiScopeSchema } from "@usetagih/schema";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { apiKeys } from "../schema/api-keys.js";

function parseScopes(scopes: string[]): ApiKeyRecord["scopes"] {
	return scopes.map((scope) => ApiScopeSchema.parse(scope));
}

function mapRow(row: typeof apiKeys.$inferSelect): ApiKeyRecord {
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		name: row.name,
		prefix: row.prefix,
		scopes: parseScopes(row.scopes),
		expiresAt: row.expiresAt,
		revokedAt: row.revokedAt,
		createdAt: row.createdAt,
	};
}

export function createApiKeyRepo(db: Db): ApiKeyRepo {
	return {
		async create(input: ApiKeyCreateInput) {
			const [row] = await db
				.insert(apiKeys)
				.values({
					workspaceId: input.workspaceId,
					name: input.name,
					prefix: input.prefix,
					keyHash: input.keyHash,
					scopes: input.scopes,
					expiresAt: input.expiresAt ?? null,
				})
				.returning();

			if (!row) {
				throw new Error("api key insert returned no row");
			}

			return mapRow(row);
		},

		async listByWorkspace(workspaceId: string) {
			const rows = await db
				.select()
				.from(apiKeys)
				.where(eq(apiKeys.workspaceId, workspaceId))
				.orderBy(apiKeys.createdAt);

			return rows.map(mapRow);
		},

		async findByPrefix(prefix: string) {
			const rows = await db
				.select()
				.from(apiKeys)
				.where(eq(apiKeys.prefix, prefix))
				.orderBy(apiKeys.createdAt);

			const row = rows[0];
			if (!row) {
				return null;
			}

			return { ...mapRow(row), keyHash: row.keyHash };
		},

		async findById(workspaceId: string, id: string) {
			const [row] = await db
				.select()
				.from(apiKeys)
				.where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)))
				.limit(1);

			return row ? mapRow(row) : null;
		},

		async revoke(workspaceId: string, id: string) {
			const existing = await this.findById(workspaceId, id);
			if (!existing) {
				return null;
			}

			if (existing.revokedAt) {
				return existing;
			}

			const revokedAt = new Date();
			const [row] = await db
				.update(apiKeys)
				.set({ revokedAt })
				.where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)))
				.returning();

			return row ? mapRow(row) : null;
		},
	};
}
