export type LogoContentType = "image/png" | "image/jpeg" | "image/svg+xml";

export type IngestedLogo = {
	bytes: Uint8Array;
	logoChecksum: string;
	contentType: LogoContentType;
	storageKey: string;
};

export interface LogoBlobStore {
	put(params: {
		workspaceId: string;
		storageKey: string;
		body: Uint8Array;
		contentType: LogoContentType;
	}): Promise<void>;

	get(params: {
		workspaceId: string;
		storageKey: string;
	}): Promise<Uint8Array | null>;
}
