import type {
	NewRenderRecord,
	RenderListQuery,
	RenderRecord,
	RenderRepo,
} from "@usetagih/core";
import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import type { Db } from "../client.js";
import { renders } from "../schema/renders.js";

function buildWorkspaceListFilters(
	workspaceId: string,
	query: RenderListQuery,
): SQL | undefined {
	const filters: SQL[] = [eq(renders.workspaceId, workspaceId)];

	if (query.documentType) {
		filters.push(eq(renders.documentType, query.documentType));
	}
	if (query.from) {
		filters.push(gte(renders.createdAt, query.from));
	}
	if (query.to) {
		filters.push(lte(renders.createdAt, query.to));
	}

	return and(...filters);
}

export function createRenderRepo(db: Db): RenderRepo {
	return {
		async insert(input: NewRenderRecord): Promise<RenderRecord> {
			const { id, ...rest } = input;
			const [row] = await db
				.insert(renders)
				.values(id ? { id, ...rest } : rest)
				.returning();
			if (!row) {
				throw new Error("render insert returned no row");
			}
			return row;
		},

		async getById(renderId: string): Promise<RenderRecord | null> {
			const [row] = await db
				.select()
				.from(renders)
				.where(eq(renders.id, renderId))
				.limit(1);
			return row ?? null;
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

		async revokeShare(renderId: string, workspaceId: string) {
			const [row] = await db
				.update(renders)
				.set({ shareToken: null, shareExpiresAt: null })
				.where(
					and(eq(renders.id, renderId), eq(renders.workspaceId, workspaceId)),
				)
				.returning();
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

		async listByWorkspacePaginated(
			workspaceId: string,
			query: RenderListQuery,
		) {
			const where = buildWorkspaceListFilters(workspaceId, query);

			const [countRow] = await db
				.select({ total: count() })
				.from(renders)
				.where(where);

			const items = await db
				.select()
				.from(renders)
				.where(where)
				.orderBy(desc(renders.createdAt))
				.limit(query.limit)
				.offset(query.offset);

			return {
				items,
				total: Number(countRow?.total ?? 0),
			};
		},
	} satisfies RenderRepo;
}
