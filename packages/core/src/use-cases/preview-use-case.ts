import type {
	ApiErrorDetail,
	DocumentPayload,
	DocumentType,
	ErrorCode,
} from "@usetagih/schema";
import type { WorkspaceTier } from "../ports/domain-types.js";
import type { IngestedLogo } from "../ports/logo-blob-store.js";
import {
	type MergedBranding,
	type ResolveLogoDeps,
	resolveLogoUseCase,
} from "./resolve-logo-use-case.js";
import { validateUseCase } from "./validate-use-case.js";

export type PreviewRenderResult = {
	pageCount: number;
	pages: Array<{ index: number; svg: string }>;
	html: string;
};

export type PreviewUseCaseInput = {
	pathDocumentType: DocumentType;
	rawPayload: unknown;
	workspaceId: string;
	workspaceTier: WorkspaceTier;
	workspaceBranding?: MergedBranding | null;
};

export type PreviewUseCaseSuccess = {
	ok: true;
	pageCount: number;
	pages: Array<{ index: number; svg: string }>;
	html: string;
};

export type PreviewUseCaseFailure = {
	ok: false;
	code: ErrorCode;
	details: ApiErrorDetail[];
};

export type PreviewUseCaseResult =
	| PreviewUseCaseSuccess
	| PreviewUseCaseFailure;

export type PreviewUseCaseDeps = {
	resolveLogoDeps: ResolveLogoDeps;
	templateExists: (documentType: DocumentType, template: string) => boolean;
	renderPreviewFromPayload: (input: {
		payload: DocumentPayload;
		workspaceTier: WorkspaceTier;
		logo: IngestedLogo | null;
	}) => PreviewRenderResult;
};

export async function previewUseCase(
	input: PreviewUseCaseInput,
	deps: PreviewUseCaseDeps,
): Promise<PreviewUseCaseResult> {
	const validation = validateUseCase({
		pathDocumentType: input.pathDocumentType,
		rawPayload: input.rawPayload,
	});

	if (!validation.valid) {
		return {
			ok: false,
			code: validation.code,
			details: validation.details,
		};
	}

	const payload = validation.normalizedPreview;

	if (!deps.templateExists(payload.documentType, payload.template)) {
		return {
			ok: false,
			code: "INVALID_REQUEST",
			details: [
				{
					path: "/template",
					code: "INVALID_REQUEST",
					message: `Template "${payload.template}" is not available for ${payload.documentType} preview`,
				},
			],
		};
	}

	const logoResult = await resolveLogoUseCase(
		{
			workspaceId: input.workspaceId,
			workspaceBranding: input.workspaceBranding,
			payloadBranding: payload.branding ?? null,
		},
		deps.resolveLogoDeps,
	);

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

	const rendered = deps.renderPreviewFromPayload({
		payload,
		workspaceTier: input.workspaceTier,
		logo: logoResult.logo,
	});

	return {
		ok: true,
		pageCount: rendered.pageCount,
		pages: rendered.pages,
		html: rendered.html,
	};
}
