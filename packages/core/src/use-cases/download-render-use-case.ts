import { createHash } from "node:crypto";
import type {
	ArtifactStore,
	RenderRecord,
	RenderRepo,
} from "../ports/index.js";
import { parseRenderId } from "../render-id.js";

export type DownloadRenderUseCaseInput = {
	apiRenderId: string;
	workspaceId: string;
};

export type DownloadRenderUseCaseSuccess = {
	ok: true;
	pdfBytes: Uint8Array;
	filename: string;
	sha256: string;
};

export type DownloadRenderUseCaseFailure = {
	ok: false;
	code: "NOT_FOUND" | "INTERNAL_ERROR";
	message: string;
};

export type DownloadRenderUseCaseResult =
	| DownloadRenderUseCaseSuccess
	| DownloadRenderUseCaseFailure;

function verifySha256(body: Uint8Array, expected: string): boolean {
	const actual = createHash("sha256").update(body).digest("hex");
	return actual === expected;
}

function isDownloadReady(
	record: RenderRecord | null,
): record is RenderRecord & {
	status: "completed";
	r2Key: string;
	sha256: string;
} {
	return (
		record?.status === "completed" &&
		Boolean(record.r2Key) &&
		Boolean(record.sha256)
	);
}

export async function downloadRenderUseCase(
	input: DownloadRenderUseCaseInput,
	deps: { renderRepo: RenderRepo; artifactStore: ArtifactStore },
): Promise<DownloadRenderUseCaseResult> {
	const renderUuid = parseRenderId(input.apiRenderId);
	if (!renderUuid) {
		return { ok: false, code: "NOT_FOUND", message: "Render not found" };
	}

	const record = await deps.renderRepo.getByIdAndWorkspace(
		renderUuid,
		input.workspaceId,
	);
	if (!isDownloadReady(record)) {
		return { ok: false, code: "NOT_FOUND", message: "Render not found" };
	}

	const pdfBytes = await deps.artifactStore.get({
		workspaceId: input.workspaceId,
		key: record.r2Key,
	});
	if (!pdfBytes) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Render artifact not found",
		};
	}

	if (!verifySha256(pdfBytes, record.sha256)) {
		return {
			ok: false,
			code: "INTERNAL_ERROR",
			message: "Artifact checksum mismatch",
		};
	}

	return {
		ok: true,
		pdfBytes,
		filename: `${input.apiRenderId}.pdf`,
		sha256: record.sha256,
	};
}
