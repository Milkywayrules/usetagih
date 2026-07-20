// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { IdempotencyStore } from "@usetagih/core";
import { Elysia } from "elysia";
import type { ApiEnv } from "../../env.js";
import {
	DOCUMENT_TYPE_PATHS,
	PATH_SEGMENT_TO_DOCUMENT_TYPE,
} from "../../lib/document-type-paths.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";

export type RenderByDocumentTypeStubDeps = {
	idempotencyStore: IdempotencyStore;
	env: ApiEnv;
	onRenderStubInvoked?: () => void;
};

function createRenderStubHandler(
	documentTypePath: (typeof DOCUMENT_TYPE_PATHS)[number],
	deps: RenderByDocumentTypeStubDeps,
) {
	return ({ status }: { status: (code: number, body: unknown) => unknown }) => {
		deps.onRenderStubInvoked?.();
		const renderId = `rnd_${crypto.randomUUID()}`;
		const shareToken = crypto.randomUUID();
		const webPublicUrl = deps.env.USETAGIH_WEB_PUBLIC_URL.replace(/\/$/, "");
		return status(201, {
			renderId,
			status: "completed" as const,
			shareUrl: `${webPublicUrl}/share/${shareToken}`,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			schemaVersion: "2026-07-20",
			documentType: PATH_SEGMENT_TO_DOCUMENT_TYPE[documentTypePath],
			template: "modern",
		});
	};
}

export function createRenderByDocumentTypeStubRoutes(
	deps: RenderByDocumentTypeStubDeps,
) {
	let app = new Elysia({ name: "render-by-document-type-stub" });

	for (const documentTypePath of DOCUMENT_TYPE_PATHS) {
		app = app.use(
			createIdempotencyMiddleware({
				idempotencyStore: deps.idempotencyStore,
				documentTypePath,
				handler: createRenderStubHandler(documentTypePath, deps),
			}),
		);
	}

	return app;
}
