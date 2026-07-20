import type { NewRenderRecord, RenderRecord } from "./domain-types.js";

export type { NewRenderRecord, RenderRecord } from "./domain-types.js";

export interface RenderRepo {
	insert(input: NewRenderRecord): Promise<RenderRecord>;
	getByIdAndWorkspace(
		renderId: string,
		workspaceId: string,
	): Promise<RenderRecord | null>;
	listByWorkspace(workspaceId: string, limit?: number): Promise<RenderRecord[]>;
}
