import type { NewRenderRecord, RenderRecord } from "./domain-types.js";

export type { NewRenderRecord, RenderRecord } from "./domain-types.js";

export type RenderListQuery = {
	limit: number;
	offset: number;
	documentType?: string;
	from?: Date;
	to?: Date;
};

export type RenderListPage = {
	items: RenderRecord[];
	total: number;
};

export interface RenderRepo {
	insert(input: NewRenderRecord): Promise<RenderRecord>;
	getById(renderId: string): Promise<RenderRecord | null>;
	getByIdAndWorkspace(
		renderId: string,
		workspaceId: string,
	): Promise<RenderRecord | null>;
	revokeShare(
		renderId: string,
		workspaceId: string,
	): Promise<RenderRecord | null>;
	listByWorkspace(workspaceId: string, limit?: number): Promise<RenderRecord[]>;
	listByWorkspacePaginated(
		workspaceId: string,
		query: RenderListQuery,
	): Promise<RenderListPage>;
}
