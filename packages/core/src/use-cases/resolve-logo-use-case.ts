import type { IngestedLogo } from "../ports/logo-blob-store.js";

export type MergedBranding = {
	logoUrl?: string;
	accentColor?: string;
};

export type ResolveLogoInput = {
	workspaceId: string;
	workspaceBranding?: MergedBranding | null;
	payloadBranding?: MergedBranding | null;
};

export type ResolveLogoDeps = {
	ingestFromUrl: (url: string) => Promise<IngestedLogo>;
	getStoredLogo: (params: {
		workspaceId: string;
		logoChecksum: string;
		storageKey: string;
	}) => Promise<IngestedLogo | null>;
	storeLogo: (
		logo: IngestedLogo & { workspaceId: string; logoUrl: string },
	) => Promise<void>;
	findLogoByUrl?: (params: {
		workspaceId: string;
		logoUrl: string;
	}) => Promise<IngestedLogo | null>;
};

export type ResolveLogoSuccess = {
	ok: true;
	logo: IngestedLogo | null;
	mergedBranding: MergedBranding;
};

export type ResolveLogoFailure = {
	ok: false;
	code: "VALIDATION_FAILED";
	message: string;
	path: "/branding/logoUrl";
};

export type ResolveLogoResult = ResolveLogoSuccess | ResolveLogoFailure;

export function mergeBranding(
	workspaceBranding?: MergedBranding | null,
	payloadBranding?: MergedBranding | null,
): MergedBranding {
	return {
		...(workspaceBranding ?? {}),
		...(payloadBranding ?? {}),
	};
}

export async function resolveLogoUseCase(
	input: ResolveLogoInput,
	deps: ResolveLogoDeps,
): Promise<ResolveLogoResult> {
	const mergedBranding = mergeBranding(
		input.workspaceBranding,
		input.payloadBranding,
	);
	const logoUrl = mergedBranding.logoUrl;

	if (!logoUrl) {
		return { ok: true, logo: null, mergedBranding };
	}

	try {
		if (deps.findLogoByUrl) {
			const cached = await deps.findLogoByUrl({
				workspaceId: input.workspaceId,
				logoUrl,
			});
			if (cached) {
				return { ok: true, logo: cached, mergedBranding };
			}
		}

		const ingested = await deps.ingestFromUrl(logoUrl);
		await deps.storeLogo({
			...ingested,
			workspaceId: input.workspaceId,
			logoUrl,
		});

		return { ok: true, logo: ingested, mergedBranding };
	} catch (error) {
		return {
			ok: false,
			code: "VALIDATION_FAILED",
			message: error instanceof Error ? error.message : "logo ingestion failed",
			path: "/branding/logoUrl",
		};
	}
}

export async function resolveLogoUseCaseFromStorage(
	input: ResolveLogoInput & {
		existingLogo?: { logoChecksum: string; storageKey: string } | null;
	},
	deps: ResolveLogoDeps,
): Promise<ResolveLogoResult> {
	const mergedBranding = mergeBranding(
		input.workspaceBranding,
		input.payloadBranding,
	);
	const logoUrl = mergedBranding.logoUrl;

	if (!logoUrl) {
		return { ok: true, logo: null, mergedBranding };
	}

	if (input.existingLogo) {
		const stored = await deps.getStoredLogo({
			workspaceId: input.workspaceId,
			logoChecksum: input.existingLogo.logoChecksum,
			storageKey: input.existingLogo.storageKey,
		});
		if (stored) {
			return { ok: true, logo: stored, mergedBranding };
		}
	}

	return resolveLogoUseCase(input, deps);
}
