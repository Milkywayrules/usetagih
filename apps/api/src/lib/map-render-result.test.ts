import { expect, test } from "bun:test";
import { mapRenderResultToResponse } from "./map-render-result.js";

test("mapRenderResultToResponse returns 201 body with Location header", () => {
	const set = {
		status: 200,
		headers: {} as Record<string, string | number | undefined>,
	};

	const body = mapRenderResultToResponse(
		{ requestId: "req_test", set },
		{
			ok: true,
			renderId: "rnd_abc",
			status: "completed",
			shareUrl: "https://app.example.com/share/token",
			expiresAt: "2026-10-18T00:00:00.000Z",
			schemaVersion: "2026-07-20",
			documentType: "invoice",
			template: "modern",
			lineItemCount: 1,
			stages: {
				validateMs: 1,
				logoMs: 0,
				typstMs: 10,
				uploadMs: 2,
				persistMs: 3,
				totalMs: 16,
			},
		},
	);

	expect(set.status).toBe(201);
	expect(set.headers.Location).toBe("/v1/renders/rnd_abc");
	expect(body).toEqual({
		renderId: "rnd_abc",
		status: "completed",
		shareUrl: "https://app.example.com/share/token",
		expiresAt: "2026-10-18T00:00:00.000Z",
		schemaVersion: "2026-07-20",
		documentType: "invoice",
		template: "modern",
	});
});
