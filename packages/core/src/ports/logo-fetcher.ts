import type { LogoContentType } from "./logo-blob-store.js";

export interface LogoFetcher {
	fetchLogo(url: string): Promise<{
		bytes: Uint8Array;
		contentType: LogoContentType;
	}>;
}
