import type { PreviewUseCaseDeps, ResolveLogoDeps } from "@usetagih/core";
import {
	createMemoryLogoBlobStore,
	documentTemplateExists,
	ingestLogoFromUrl,
	renderPreviewFromPayload,
} from "@usetagih/render";

type LogoBlobStoreInstance = ReturnType<typeof createMemoryLogoBlobStore>;

export type PreviewRuntimeDeps = {
	logoBlobStore: LogoBlobStoreInstance;
	createPreviewUseCaseDeps: (workspaceId: string) => PreviewUseCaseDeps;
};

function createResolveLogoDeps(
	logoBlobStore: LogoBlobStoreInstance,
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
	logoBlobStore: LogoBlobStoreInstance = createMemoryLogoBlobStore(),
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
