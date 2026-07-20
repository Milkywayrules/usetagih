import { expect, test } from "bun:test";
import { mapPreviewResultToResponse } from "./map-preview-result.js";

test("mapPreviewResultToResponse returns flat success body", () => {
	const body = mapPreviewResultToResponse(
		{ requestId: "req-1", set: {} },
		{
			ok: true,
			pageCount: 1,
			pages: [{ index: 1, svg: "<svg></svg>" }],
			html: '<div class="page" data-page="1"><svg></svg></div>',
		},
	);

	expect(body).toEqual({
		valid: true,
		pageCount: 1,
		pages: [{ index: 1, svg: "<svg></svg>" }],
		html: '<div class="page" data-page="1"><svg></svg></div>',
	});
});

test("mapPreviewResultToResponse maps failure to envelope", () => {
	const response = mapPreviewResultToResponse(
		{ requestId: "req-2", set: {} },
		{
			ok: false,
			code: "INVALID_REQUEST",
			details: [
				{
					path: "/template",
					code: "INVALID_REQUEST",
					message: "Template unavailable",
				},
			],
		},
	);

	expect(response).toMatchObject({
		error: {
			code: "INVALID_REQUEST",
			requestId: "req-2",
		},
	});
});
