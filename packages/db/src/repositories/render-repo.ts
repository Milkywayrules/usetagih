import type { NewRenderRecord, RenderRecord, RenderRepo } from "@usetagih/core";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { renders } from "../schema/renders.js";

export function createRenderRepo(db: Db): RenderRepo {
	return {
		async insert(input: NewRenderRecord): Promise<RenderRecord> {
			const [row] = await db.insert(renders).values(input).returning();
			if (!row) {
				throw new Error("render insert returned no row");
			}
			return row;
		},

		async getByIdAndWorkspace(
			renderId: string,
			workspaceId: string,
		): Promise<RenderRecord | null> {
			const [row] = await db
				.select()
				.from(renders)
				.where(
					and(eq(renders.id, renderId), eq(renders.workspaceId, workspaceId)),
				)
				.limit(1);
			return row ?? null;
		},

		async listByWorkspace(
			workspaceId: string,
			limit = 50,
		): Promise<RenderRecord[]> {
			return db
				.select()
				.from(renders)
				.where(eq(renders.workspaceId, workspaceId))
				.orderBy(desc(renders.createdAt))
				.limit(limit);
		},
	} satisfies RenderRepo;
}
