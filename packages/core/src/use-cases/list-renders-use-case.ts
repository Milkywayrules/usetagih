import type { RenderRepo } from "../ports/index.js";
import {
	mapRenderRecordToMetadata,
	type RenderMetadata,
} from "./render-metadata.js";

export const DEFAULT_LIST_PAGE_SIZE = 20;
export const MAX_LIST_PAGE_SIZE = 100;

export type ListRendersUseCaseInput = {
	workspaceId: string;
	webPublicUrl: string;
	page?: number;
	pageSize?: number;
	documentType?: string;
	from?: Date;
	to?: Date;
};

export type ListRendersUseCaseResult = {
	renders: RenderMetadata[];
	page: number;
	pageSize: number;
	total: number;
};

export async function listRendersUseCase(
	input: ListRendersUseCaseInput,
	renderRepo: RenderRepo,
): Promise<ListRendersUseCaseResult> {
	const page = Math.max(1, input.page ?? 1);
	const pageSize = Math.min(
		MAX_LIST_PAGE_SIZE,
		Math.max(1, input.pageSize ?? DEFAULT_LIST_PAGE_SIZE),
	);
	const offset = (page - 1) * pageSize;

	const { items, total } = await renderRepo.listByWorkspacePaginated(
		input.workspaceId,
		{
			limit: pageSize,
			offset,
			documentType: input.documentType,
			from: input.from,
			to: input.to,
		},
	);

	return {
		renders: items.map((record) =>
			mapRenderRecordToMetadata(record, input.webPublicUrl),
		),
		page,
		pageSize,
		total,
	};
}
