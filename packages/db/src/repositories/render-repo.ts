import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { type NewRender, type Render, renders } from "../schema/renders.js";

export function createRenderRepo(db: Db) {
	return {
		async insert(input: NewRender): Promise<Render> {
			const [row] = await db.insert(renders).values(input).returning();
			if (!row) {
				throw new Error("render insert returned no row");
			}
			return row;
		},

		async getByIdAndWorkspace(
			renderId: string,
			workspaceId: string,
		): Promise<Render | null> {
			const [row] = await db
				.select()
				.from(renders)
				.where(
					and(eq(renders.id, renderId), eq(renders.workspaceId, workspaceId)),
				)
				.limit(1);
			return row ?? null;
		},

		async listByWorkspace(workspaceId: string, limit = 50): Promise<Render[]> {
			return db
				.select()
				.from(renders)
				.where(eq(renders.workspaceId, workspaceId))
				.orderBy(desc(renders.createdAt))
				.limit(limit);
		},
	};
}

export type RenderRepo = ReturnType<typeof createRenderRepo>;
