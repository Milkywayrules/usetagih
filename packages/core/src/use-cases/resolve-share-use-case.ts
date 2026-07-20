import { createHash } from "node:crypto";
import type {
	ArtifactStore,
	RenderRecord,
	RenderRepo,
} from "../ports/index.js";
import { formatRenderId } from "../render-id.js";
import { verifyShareToken } from "../share-token.js";

export type SharePublicMetadata = {
	renderId: string;
	documentType: string;
	template: string;
	schemaVersion: string;
	expiresAt: string;
	downloadUrl: string;
	status: "active";
};

export type ResolveShareUseCaseInput = {
	token: string;
	shareSigningSecret: string;
	now?: Date;
};

export type ResolveShareUseCaseSuccess = {
	ok: true;
	metadata: SharePublicMetadata;
};

export type ResolveShareUseCaseFailure = {
	ok: false;
	code: "NOT_FOUND" | "EXPIRED" | "REVOKED";
	message: string;
};

export type ResolveShareUseCaseResult =
	| ResolveShareUseCaseSuccess
	| ResolveShareUseCaseFailure;

export type DownloadShareUseCaseInput = {
	token: string;
	shareSigningSecret: string;
	now?: Date;
};

export type DownloadShareUseCaseSuccess = {
	ok: true;
	pdfBytes: Uint8Array;
	filename: string;
};

export type DownloadShareUseCaseFailure = ResolveShareUseCaseFailure;

export type DownloadShareUseCaseResult =
	| DownloadShareUseCaseSuccess
	| DownloadShareUseCaseFailure;

function verifySha256(body: Uint8Array, expected: string): boolean {
	const actual = createHash("sha256").update(body).digest("hex");
	return actual === expected;
}

type ShareValidationResult =
	| {
			ok: true;
			record: RenderRecord & {
				shareToken: string;
				shareExpiresAt: Date;
				r2Key: string;
				sha256: string;
			};
	  }
	| ResolveShareUseCaseFailure;

async function validateShareAccess(
	input: { token: string; shareSigningSecret: string; now?: Date },
	renderRepo: RenderRepo,
): Promise<ShareValidationResult> {
	const payload = verifyShareToken(input.token, input.shareSigningSecret);
	if (!payload) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Share link not found",
		};
	}

	const now = input.now ?? new Date();
	if (payload.e * 1000 <= now.getTime()) {
		return {
			ok: false,
			code: "EXPIRED",
			message: "This share link has expired",
		};
	}

	const record = await renderRepo.getById(payload.r);
	if (record?.status !== "completed") {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Share link not found",
		};
	}

	if (!record.shareToken) {
		return {
			ok: false,
			code: "REVOKED",
			message: "This share link has been revoked",
		};
	}

	if (record.shareToken !== input.token) {
		return {
			ok: false,
			code: "REVOKED",
			message: "This share link has been revoked",
		};
	}

	if (!record.r2Key || !record.sha256 || !record.shareExpiresAt) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Share link not found",
		};
	}

	if (record.shareExpiresAt.getTime() <= now.getTime()) {
		return {
			ok: false,
			code: "EXPIRED",
			message: "This share link has expired",
		};
	}

	return {
		ok: true,
		record: record as RenderRecord & {
			shareToken: string;
			shareExpiresAt: Date;
			r2Key: string;
			sha256: string;
		},
	};
}

export async function resolveShareUseCase(
	input: ResolveShareUseCaseInput,
	renderRepo: RenderRepo,
): Promise<ResolveShareUseCaseResult> {
	const validated = await validateShareAccess(input, renderRepo);
	if (!validated.ok) {
		return validated;
	}

	const encodedToken = encodeURIComponent(input.token);

	return {
		ok: true,
		metadata: {
			renderId: formatRenderId(validated.record.id),
			documentType: validated.record.documentType,
			template: validated.record.template,
			schemaVersion: validated.record.schemaVersion,
			expiresAt: validated.record.shareExpiresAt.toISOString(),
			downloadUrl: `/v1/share/${encodedToken}/download`,
			status: "active",
		},
	};
}

export async function downloadShareUseCase(
	input: DownloadShareUseCaseInput,
	deps: { renderRepo: RenderRepo; artifactStore: ArtifactStore },
): Promise<DownloadShareUseCaseResult> {
	const validated = await validateShareAccess(input, deps.renderRepo);
	if (!validated.ok) {
		return validated;
	}

	const pdfBytes = await deps.artifactStore.get({
		workspaceId: validated.record.workspaceId,
		key: validated.record.r2Key,
	});
	if (!pdfBytes) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Share link not found",
		};
	}

	if (!verifySha256(pdfBytes, validated.record.sha256)) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Share link not found",
		};
	}

	return {
		ok: true,
		pdfBytes,
		filename: `${formatRenderId(validated.record.id)}.pdf`,
	};
}
