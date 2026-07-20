// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import { validateUseCase } from "@usetagih/core";
import { Elysia } from "elysia";
import {
	DOCUMENT_TYPE_PATHS,
	PATH_SEGMENT_TO_DOCUMENT_TYPE,
} from "../../lib/document-type-paths.js";
import { mapValidateResultToResponse } from "../../lib/map-validate-result.js";

export function createValidateByDocumentTypeRoutes() {
	let app = new Elysia({ name: "validate-by-document-type" });

	for (const documentTypePath of DOCUMENT_TYPE_PATHS) {
		const pathDocumentType = PATH_SEGMENT_TO_DOCUMENT_TYPE[documentTypePath];

		app = app.post(
			`/${documentTypePath}/validate`,
			({ body, requestId, set, request }) => {
				const result = validateUseCase({
					pathDocumentType,
					rawPayload: body,
				});
				return mapValidateResultToResponse({ requestId, set, request }, result);
			},
			{
				authenticated: true,
				requireScope: "renders:write",
			} as never,
		);
	}

	return app;
}
