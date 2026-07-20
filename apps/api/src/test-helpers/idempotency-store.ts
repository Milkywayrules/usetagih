import type { IdempotencyLookupResult, IdempotencyStore } from "@usetagih/core";

export class MemoryIdempotencyStore implements IdempotencyStore {
	private readonly rows = new Map<
		string,
		{
			requestHash: string;
			responseBody: unknown;
			expiresAt: Date;
		}
	>();

	private key(workspaceId: string, endpoint: string, keyHash: string) {
		return `${workspaceId}:${endpoint}:${keyHash}`;
	}

	async lookup(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
	}): Promise<IdempotencyLookupResult> {
		const row = this.rows.get(
			this.key(params.workspaceId, params.endpoint, params.keyHash),
		);
		if (!row || row.expiresAt <= new Date()) {
			return { status: "miss" };
		}
		return {
			status: "hit",
			requestHash: row.requestHash,
			responseBody: row.responseBody,
		};
	}

	async store(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
		requestHash: string;
		responseBody: unknown;
		expiresAt: Date;
	}) {
		this.rows.set(
			this.key(params.workspaceId, params.endpoint, params.keyHash),
			{
				requestHash: params.requestHash,
				responseBody: params.responseBody,
				expiresAt: params.expiresAt,
			},
		);
	}
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
	return new MemoryIdempotencyStore();
}
