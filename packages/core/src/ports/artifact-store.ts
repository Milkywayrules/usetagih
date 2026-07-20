export interface ArtifactStore {
	put(params: {
		workspaceId: string;
		key: string;
		body: Uint8Array;
		contentType: "application/pdf";
	}): Promise<{ sha256: string; byteSize: number }>;

	get(params: { workspaceId: string; key: string }): Promise<Uint8Array | null>;

	delete(params: { workspaceId: string; key: string }): Promise<void>;
}
