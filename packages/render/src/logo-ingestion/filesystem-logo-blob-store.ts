import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
	IngestedLogo,
	LogoBlobStore,
	LogoContentType,
} from "@usetagih/core";

/** Local filesystem stub aligned with MinIO key layout — not production R2 wiring. */
export class FilesystemLogoBlobStore implements LogoBlobStore {
	constructor(private readonly rootDir: string) {}

	private absolutePath(workspaceId: string, storageKey: string): string {
		if (storageKey.includes("..")) {
			throw new Error("invalid storage key");
		}
		return join(
			this.rootDir,
			workspaceId,
			storageKey.replace(`logos/${workspaceId}/`, "logos/"),
		);
	}

	async put(params: {
		workspaceId: string;
		storageKey: string;
		body: Uint8Array;
		contentType: LogoContentType;
	}): Promise<void> {
		const path = this.absolutePath(params.workspaceId, params.storageKey);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, params.body);
	}

	async get(params: {
		workspaceId: string;
		storageKey: string;
	}): Promise<Uint8Array | null> {
		const path = this.absolutePath(params.workspaceId, params.storageKey);
		try {
			return readFileSync(path);
		} catch {
			return null;
		}
	}

	async getIngested(params: {
		workspaceId: string;
		logo: IngestedLogo;
	}): Promise<IngestedLogo | null> {
		const bytes = await this.get({
			workspaceId: params.workspaceId,
			storageKey: params.logo.storageKey,
		});
		if (!bytes) {
			return null;
		}
		return { ...params.logo, bytes };
	}
}

export function createFilesystemLogoBlobStore(
	rootDir: string,
): FilesystemLogoBlobStore {
	return new FilesystemLogoBlobStore(rootDir);
}
