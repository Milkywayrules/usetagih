import type { PreviewUseCaseDeps, ResolveLogoDeps } from "@usetagih/core";
import {
	createMemoryLogoBlobStore,
	documentTemplateExists,
	ingestLogoFromUrl,
	type MemoryLogoBlobStore,
	renderPreviewFromPayload,
} from "@usetagih/render";

export type PreviewRuntimeDeps = {
	logoBlobStore: MemoryLogoBlobStore;
	createPreviewUseCaseDeps: (workspaceId: string) => PreviewUseCaseDeps;
};

function createResolveLogoDeps(
	logoBlobStore: MemoryLogoBlobStore,
	workspaceId: string,
): ResolveLogoDeps {
	return {
		ingestFromUrl: async (url) => {
			const result = await ingestLogoFromUrl(url, workspaceId, {});
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result.logo;
		},
		getStoredLogo: async ({ workspaceId: wsId, logoChecksum, storageKey }) => {
			return logoBlobStore.getIngested({
				workspaceId: wsId,
				logoChecksum,
				storageKey,
			});
		},
		storeLogo: async (logo) => {
			logoBlobStore.putWithUrl({
				workspaceId: logo.workspaceId,
				logoUrl: logo.logoUrl,
				logo,
			});
		},
		findLogoByUrl: async ({ workspaceId: wsId, logoUrl }) => {
			return logoBlobStore.findByUrl({ workspaceId: wsId, logoUrl });
		},
	};
}

export function createPreviewRuntimeDeps(
	logoBlobStore: MemoryLogoBlobStore = createMemoryLogoBlobStore(),
): PreviewRuntimeDeps {
	return {
		logoBlobStore,
		createPreviewUseCaseDeps: (workspaceId: string): PreviewUseCaseDeps => ({
			resolveLogoDeps: createResolveLogoDeps(logoBlobStore, workspaceId),
			templateExists: documentTemplateExists,
			renderPreviewFromPayload,
		}),
	};
}
