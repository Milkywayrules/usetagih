import type { RenderRepo } from "../ports/index.js";
import { parseRenderId } from "../render-id.js";

export type RevokeShareUseCaseInput = {
	apiRenderId: string;
	workspaceId: string;
};

export type RevokeShareUseCaseSuccess = {
	ok: true;
	renderId: string;
	revoked: true;
};

export type RevokeShareUseCaseFailure = {
	ok: false;
	code: "NOT_FOUND";
	message: string;
};

export type RevokeShareUseCaseResult =
	| RevokeShareUseCaseSuccess
	| RevokeShareUseCaseFailure;

export async function revokeShareUseCase(
	input: RevokeShareUseCaseInput,
	renderRepo: RenderRepo,
): Promise<RevokeShareUseCaseResult> {
	const renderUuid = parseRenderId(input.apiRenderId);
	if (!renderUuid) {
		return { ok: false, code: "NOT_FOUND", message: "Render not found" };
	}

	const record = await renderRepo.revokeShare(renderUuid, input.workspaceId);
	if (!record) {
		return { ok: false, code: "NOT_FOUND", message: "Render not found" };
	}

	return {
		ok: true,
		renderId: input.apiRenderId,
		revoked: true,
	};
}
