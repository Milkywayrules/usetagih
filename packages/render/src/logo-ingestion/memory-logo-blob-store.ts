import type {
	IngestedLogo,
	LogoBlobStore,
	LogoContentType,
} from "@usetagih/core";

type StoredEntry = {
	body: Uint8Array;
	contentType: LogoContentType;
	logoChecksum: string;
	storageKey: string;
};

export class MemoryLogoBlobStore implements LogoBlobStore {
	private readonly blobs = new Map<string, StoredEntry>();
	private readonly urlIndex = new Map<string, string>();

	private blobKey(workspaceId: string, storageKey: string): string {
		return `${workspaceId}:${storageKey}`;
	}

	private urlKey(workspaceId: string, logoUrl: string): string {
		return `${workspaceId}:${logoUrl}`;
	}

	async put(params: {
		workspaceId: string;
		storageKey: string;
		body: Uint8Array;
		contentType: LogoContentType;
	}): Promise<void> {
		const checksum = params.storageKey.split("/").pop()?.split(".")[0];
		if (!checksum) {
			throw new Error("invalid logo storage key");
		}
		this.blobs.set(this.blobKey(params.workspaceId, params.storageKey), {
			body: params.body,
			contentType: params.contentType,
			logoChecksum: checksum,
			storageKey: params.storageKey,
		});
	}

	async get(params: {
		workspaceId: string;
		storageKey: string;
	}): Promise<Uint8Array | null> {
		return (
			this.blobs.get(this.blobKey(params.workspaceId, params.storageKey))
				?.body ?? null
		);
	}

	putWithUrl(params: {
		workspaceId: string;
		logoUrl: string;
		logo: IngestedLogo;
	}): void {
		this.urlIndex.set(
			this.urlKey(params.workspaceId, params.logoUrl),
			params.logo.storageKey,
		);
		void this.put({
			workspaceId: params.workspaceId,
			storageKey: params.logo.storageKey,
			body: params.logo.bytes,
			contentType: params.logo.contentType,
		});
	}

	findByUrl(params: {
		workspaceId: string;
		logoUrl: string;
	}): IngestedLogo | null {
		const storageKey = this.urlIndex.get(
			this.urlKey(params.workspaceId, params.logoUrl),
		);
		if (!storageKey) {
			return null;
		}
		const entry = this.blobs.get(this.blobKey(params.workspaceId, storageKey));
		if (!entry) {
			return null;
		}
		return {
			bytes: entry.body,
			logoChecksum: entry.logoChecksum,
			contentType: entry.contentType,
			storageKey: entry.storageKey,
		};
	}

	getIngested(params: {
		workspaceId: string;
		logoChecksum: string;
		storageKey: string;
	}): IngestedLogo | null {
		const entry = this.blobs.get(
			this.blobKey(params.workspaceId, params.storageKey),
		);
		if (!entry || entry.logoChecksum !== params.logoChecksum) {
			return null;
		}
		return {
			bytes: entry.body,
			logoChecksum: entry.logoChecksum,
			contentType: entry.contentType,
			storageKey: entry.storageKey,
		};
	}
}

export function createMemoryLogoBlobStore(): MemoryLogoBlobStore {
	return new MemoryLogoBlobStore();
}
