export type IdempotencyLookupResult =
	| { status: "miss" }
	| {
			status: "hit";
			requestHash: string;
			responseBody: unknown;
	  }
	| {
			status: "conflict";
			storedRequestHash: string;
			incomingRequestHash: string;
	  };

export interface IdempotencyStore {
	lookup(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
	}): Promise<IdempotencyLookupResult>;

	store(params: {
		workspaceId: string;
		endpoint: string;
		keyHash: string;
		requestHash: string;
		responseBody: unknown;
		expiresAt: Date;
	}): Promise<void>;
}
