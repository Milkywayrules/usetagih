import { createHash, randomUUID } from "node:crypto";
import type {
	ApiErrorDetail,
	DocumentPayload,
	DocumentType,
	ErrorCode,
} from "@usetagih/schema";
import type {
	ArtifactStore,
	RenderRepo,
	WorkspaceTier,
} from "../ports/index.js";
import type { IngestedLogo } from "../ports/logo-blob-store.js";
import {
	type MergedBranding,
	type ResolveLogoDeps,
	resolveLogoUseCase,
} from "./resolve-logo-use-case.js";
import { validateUseCase } from "./validate-use-case.js";

export const SYNC_MAX_LINE_ITEMS = 100;
export const DEFAULT_SHARE_TTL_DAYS = 90;

export type RenderPdfResult = {
	pdfBytes: Uint8Array;
	sha256: string;
	byteSize: number;
};

export type RenderUseCaseInput = {
	pathDocumentType: DocumentType;
	rawPayload: unknown;
	workspaceId: string;
	workspaceTier: WorkspaceTier;
	workspaceBranding?: MergedBranding | null;
	idempotencyHash?: string | null;
	webPublicUrl: string;
};

export type RenderStageTimings = {
	validateMs: number;
	logoMs: number;
	typstMs: number;
	uploadMs: number;
	persistMs: number;
	totalMs: number;
};

export type RenderUseCaseSuccess = {
	ok: true;
	renderId: string;
	status: "completed";
	shareUrl: string;
	expiresAt: string;
	schemaVersion: string;
	documentType: DocumentType;
	template: string;
	lineItemCount: number;
	stages: RenderStageTimings;
};

export type RenderUseCaseFailure = {
	ok: false;
	code: ErrorCode;
	details: ApiErrorDetail[];
};

export type RenderUseCaseResult = RenderUseCaseSuccess | RenderUseCaseFailure;

export type RenderUseCaseDeps = {
	resolveLogoDeps: ResolveLogoDeps;
	templateExists: (documentType: DocumentType, template: string) => boolean;
	renderPdfFromPayload: (input: {
		payload: DocumentPayload;
		workspaceTier: WorkspaceTier;
		logo: IngestedLogo | null;
	}) => RenderPdfResult;
	renderRepo: RenderRepo;
	artifactStore: ArtifactStore;
	generateRenderId?: () => string;
	generateShareToken?: () => string;
	now?: () => Date;
};

export function hashPayload(payload: DocumentPayload): string {
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toApiRenderId(uuid: string): string {
	return `rnd_${uuid}`;
}

function buildArtifactKey(workspaceId: string, apiRenderId: string): string {
	return `renders/${workspaceId}/${apiRenderId}.pdf`;
}

export async function renderUseCase(
	input: RenderUseCaseInput,
	deps: RenderUseCaseDeps,
): Promise<RenderUseCaseResult> {
	const totalStarted = Date.now();
	const validateStarted = Date.now();

	const validation = validateUseCase({
		pathDocumentType: input.pathDocumentType,
		rawPayload: input.rawPayload,
	});

	const validateMs = Date.now() - validateStarted;

	if (!validation.valid) {
		return {
			ok: false,
			code: validation.code,
			details: validation.details,
		};
	}

	const payload = validation.normalizedPreview;

	if (payload.lineItems.length > SYNC_MAX_LINE_ITEMS) {
		return {
			ok: false,
			code: "INVALID_REQUEST",
			details: [
				{
					path: "/lineItems",
					code: "INVALID_REQUEST",
					message: `Sync render supports at most ${SYNC_MAX_LINE_ITEMS} line items; use async render for larger payloads`,
				},
			],
		};
	}

	if (!deps.templateExists(payload.documentType, payload.template)) {
		return {
			ok: false,
			code: "INVALID_REQUEST",
			details: [
				{
					path: "/template",
					code: "INVALID_REQUEST",
					message: `Template "${payload.template}" is not available for ${payload.documentType} render`,
				},
			],
		};
	}

	const logoStarted = Date.now();
	const logoResult = await resolveLogoUseCase(
		{
			workspaceId: input.workspaceId,
			workspaceBranding: input.workspaceBranding,
			payloadBranding: payload.branding ?? null,
		},
		deps.resolveLogoDeps,
	);
	const logoMs = Date.now() - logoStarted;

	if (!logoResult.ok) {
		return {
			ok: false,
			code: logoResult.code,
			details: [
				{
					path: logoResult.path,
					code: logoResult.code,
					message: logoResult.message,
				},
			],
		};
	}

	const typstStarted = Date.now();
	const rendered = (() => {
		try {
			return deps.renderPdfFromPayload({
				payload,
				workspaceTier: input.workspaceTier,
				logo: logoResult.logo,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "render failed";
			throw Object.assign(new Error(message), {
				renderFailure: true as const,
			});
		}
	})();
	const typstMs = Date.now() - typstStarted;

	const renderUuid = deps.generateRenderId?.() ?? randomUUID();
	const apiRenderId = toApiRenderId(renderUuid);
	const artifactKey = buildArtifactKey(input.workspaceId, apiRenderId);

	const uploadStarted = Date.now();
	const stored = await deps.artifactStore.put({
		workspaceId: input.workspaceId,
		key: artifactKey,
		body: rendered.pdfBytes,
		contentType: "application/pdf",
	});
	const uploadMs = Date.now() - uploadStarted;

	const shareToken = deps.generateShareToken?.() ?? randomUUID();
	const now = deps.now?.() ?? new Date();
	const shareExpiresAt = new Date(now);
	shareExpiresAt.setUTCDate(
		shareExpiresAt.getUTCDate() + DEFAULT_SHARE_TTL_DAYS,
	);

	const resolvedTier = input.workspaceTier;
	const showWatermark = resolvedTier === "trial";
	const webPublicUrl = input.webPublicUrl.replace(/\/$/, "");

	const persistStarted = Date.now();
	await deps.renderRepo.insert({
		id: renderUuid,
		workspaceId: input.workspaceId,
		documentType: payload.documentType,
		template: payload.template,
		schemaVersion: payload.schemaVersion,
		status: "completed",
		payloadHash: hashPayload(payload),
		resolvedTier,
		showWatermark,
		idempotencyHash: input.idempotencyHash ?? null,
		r2Key: artifactKey,
		sha256: stored.sha256,
		byteSize: stored.byteSize,
		shareToken,
		shareExpiresAt,
		logoChecksum: logoResult.logo?.logoChecksum ?? null,
		brandingSnapshot: logoResult.mergedBranding,
	});
	const persistMs = Date.now() - persistStarted;

	return {
		ok: true,
		renderId: apiRenderId,
		status: "completed",
		shareUrl: `${webPublicUrl}/share/${shareToken}`,
		expiresAt: shareExpiresAt.toISOString(),
		schemaVersion: payload.schemaVersion,
		documentType: payload.documentType,
		template: payload.template,
		lineItemCount: payload.lineItems.length,
		stages: {
			validateMs,
			logoMs,
			typstMs,
			uploadMs,
			persistMs,
			totalMs: Date.now() - totalStarted,
		},
	};
}
