import { createHash } from "node:crypto";
import type { ArtifactStore } from "@usetagih/core";

export function createMemoryArtifactStore(): ArtifactStore {
	const objects = new Map<string, Uint8Array>();

	function storageKey(workspaceId: string, key: string): string {
		return `${workspaceId}:${key}`;
	}

	return {
		async put({ workspaceId, key, body }) {
			objects.set(storageKey(workspaceId, key), body);
			const sha256 = createHash("sha256").update(body).digest("hex");
			return { sha256, byteSize: body.byteLength };
		},

		async get({ workspaceId, key }) {
			return objects.get(storageKey(workspaceId, key)) ?? null;
		},

		async delete({ workspaceId, key }) {
			objects.delete(storageKey(workspaceId, key));
		},
	};
}
