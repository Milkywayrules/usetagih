import type { RenderRepo } from "../ports/index.js";
import { parseRenderId } from "../render-id.js";
import {
	mapRenderRecordToMetadata,
	type RenderMetadata,
} from "./render-metadata.js";

export type GetRenderUseCaseInput = {
	apiRenderId: string;
	workspaceId: string;
	webPublicUrl: string;
};

export type GetRenderUseCaseResult =
	| { ok: true; render: RenderMetadata }
	| { ok: false; code: "NOT_FOUND" };

export async function getRenderUseCase(
	input: GetRenderUseCaseInput,
	renderRepo: RenderRepo,
): Promise<GetRenderUseCaseResult> {
	const renderUuid = parseRenderId(input.apiRenderId);
	if (!renderUuid) {
		return { ok: false, code: "NOT_FOUND" };
	}

	const record = await renderRepo.getByIdAndWorkspace(
		renderUuid,
		input.workspaceId,
	);
	if (!record) {
		return { ok: false, code: "NOT_FOUND" };
	}

	return {
		ok: true,
		render: mapRenderRecordToMetadata(record, input.webPublicUrl),
	};
}
