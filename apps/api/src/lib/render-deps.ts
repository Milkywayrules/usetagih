import type {
	ArtifactStore,
	RenderRepo,
	RenderUseCaseDeps,
	ResolveLogoDeps,
} from "@usetagih/core";
import { createMemoryArtifactStore } from "@usetagih/db";
import {
	createMemoryLogoBlobStore,
	documentTemplateExists,
	ingestLogoFromUrl,
	renderPdfFromPayload,
} from "@usetagih/render";

type LogoBlobStoreInstance = ReturnType<typeof createMemoryLogoBlobStore>;

export type RenderRuntimeDeps = {
	logoBlobStore: LogoBlobStoreInstance;
	artifactStore: ArtifactStore;
	createRenderUseCaseDeps: (
		workspaceId: string,
		renderRepo: RenderRepo,
	) => RenderUseCaseDeps;
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

export function createRenderRuntimeDeps(options?: {
	logoBlobStore?: LogoBlobStoreInstance;
	artifactStore?: ArtifactStore;
	renderPdfFromPayload?: RenderUseCaseDeps["renderPdfFromPayload"];
}): RenderRuntimeDeps {
	const logoBlobStore = options?.logoBlobStore ?? createMemoryLogoBlobStore();
	const artifactStore = options?.artifactStore ?? createMemoryArtifactStore();
	const renderPdf = options?.renderPdfFromPayload ?? renderPdfFromPayload;

	return {
		logoBlobStore,
		artifactStore,
		createRenderUseCaseDeps: (
			workspaceId: string,
			renderRepo: RenderRepo,
		): RenderUseCaseDeps => ({
			resolveLogoDeps: createResolveLogoDeps(logoBlobStore, workspaceId),
			templateExists: documentTemplateExists,
			renderPdfFromPayload: renderPdf,
			renderRepo,
			artifactStore,
		}),
	};
}
