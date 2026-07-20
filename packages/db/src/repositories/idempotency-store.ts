import type { IdempotencyStore } from "@usetagih/core";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../client.js";
import { idempotencyKeys } from "../schema/idempotency-keys.js";

function isPostgresUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const code =
		"code" in error
			? (error as { code?: string }).code
			: "cause" in error &&
					typeof (error as { cause?: unknown }).cause === "object" &&
					(error as { cause: { code?: string } | null }).cause !== null
				? (error as { cause: { code?: string } }).cause.code
				: undefined;

	return code === "23505";
}

export function createIdempotencyStore(db: Db): IdempotencyStore {
	return {
		async lookup({ workspaceId, endpoint, keyHash }) {
			const [row] = await db
				.select({
					requestHash: idempotencyKeys.requestHash,
					responseBody: idempotencyKeys.responseBody,
				})
				.from(idempotencyKeys)
				.where(
					and(
						eq(idempotencyKeys.workspaceId, workspaceId),
						eq(idempotencyKeys.endpoint, endpoint),
						eq(idempotencyKeys.keyHash, keyHash),
						gt(idempotencyKeys.expiresAt, new Date()),
					),
				)
				.limit(1);

			if (!row) {
				return { status: "miss" };
			}

			return {
				status: "hit",
				requestHash: row.requestHash,
				responseBody: row.responseBody,
			};
		},

		async store({
			workspaceId,
			endpoint,
			keyHash,
			requestHash,
			responseBody,
			expiresAt,
		}) {
			try {
				await db.insert(idempotencyKeys).values({
					workspaceId,
					endpoint,
					keyHash,
					requestHash,
					responseBody,
					expiresAt,
				});
			} catch (error) {
				if (isPostgresUniqueViolation(error)) {
					return;
				}
				throw error;
			}
		},
	} satisfies IdempotencyStore;
}
