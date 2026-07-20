import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { RenderRecord, RenderRepo } from "../ports/index.js";
import { buildShareUrl } from "../share-token.js";
import { downloadRenderUseCase } from "./download-render-use-case.js";
import { getRenderUseCase } from "./get-render-use-case.js";
import { listRendersUseCase } from "./list-renders-use-case.js";

const WEB_PUBLIC_URL = "https://app.example.com";
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const RENDER_UUID = "00000000-0000-4000-8000-000000000099";
const API_RENDER_ID = `rnd_${RENDER_UUID}`;

function sampleRecord(overrides: Partial<RenderRecord> = {}): RenderRecord {
	return {
		id: RENDER_UUID,
		workspaceId: WORKSPACE_ID,
		documentType: "invoice",
		template: "modern",
		schemaVersion: "2026-07-20",
		status: "completed",
		payloadHash: "payload-hash",
		resolvedTier: "trial",
		showWatermark: true,
		idempotencyHash: "idem-hash-abc",
		r2Key: `renders/${WORKSPACE_ID}/${API_RENDER_ID}.pdf`,
		sha256: "abc123",
		byteSize: 4,
		shareToken: "share-token",
		shareExpiresAt: new Date("2026-10-18T00:00:00.000Z"),
		logoChecksum: null,
		brandingSnapshot: null,
		errorCode: null,
		createdAt: new Date("2026-07-20T00:00:00.000Z"),
		updatedAt: new Date("2026-07-20T00:00:00.000Z"),
		...overrides,
	};
}

function createRenderRepoMock(record: RenderRecord | null): RenderRepo {
	return {
		async insert() {
			throw new Error("unexpected insert");
		},
		async getByIdAndWorkspace(renderId, workspaceId) {
			if (workspaceId !== WORKSPACE_ID || renderId !== RENDER_UUID) {
				return null;
			}
			return record;
		},
		async getById(renderId) {
			return renderId === RENDER_UUID ? record : null;
		},
		async revokeShare() {
			return null;
		},
		async listByWorkspace() {
			return record ? [record] : [];
		},
		async listByWorkspacePaginated() {
			return {
				items: record ? [record] : [],
				total: record ? 1 : 0,
			};
		},
	};
}

describe("getRenderUseCase", () => {
	test("returns metadata for owned render", async () => {
		const result = await getRenderUseCase(
			{
				apiRenderId: API_RENDER_ID,
				workspaceId: WORKSPACE_ID,
				webPublicUrl: WEB_PUBLIC_URL,
			},
			createRenderRepoMock(sampleRecord()),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.render.renderId).toBe(API_RENDER_ID);
		expect(result.render.idempotencyFingerprint).toBe("idem-hash-abc");
		expect(result.render.shareUrl).toBe(
			buildShareUrl(WEB_PUBLIC_URL, "share-token"),
		);
	});

	test("returns NOT_FOUND for invalid render id", async () => {
		const result = await getRenderUseCase(
			{
				apiRenderId: "not-a-render-id",
				workspaceId: WORKSPACE_ID,
				webPublicUrl: WEB_PUBLIC_URL,
			},
			createRenderRepoMock(sampleRecord()),
		);
		expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
	});

	test("returns NOT_FOUND for cross-workspace lookup", async () => {
		const result = await getRenderUseCase(
			{
				apiRenderId: API_RENDER_ID,
				workspaceId: WORKSPACE_ID,
				webPublicUrl: WEB_PUBLIC_URL,
			},
			createRenderRepoMock(null),
		);
		expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
	});
});

describe("listRendersUseCase", () => {
	test("returns paginated metadata", async () => {
		const result = await listRendersUseCase(
			{
				workspaceId: WORKSPACE_ID,
				webPublicUrl: WEB_PUBLIC_URL,
				page: 1,
				pageSize: 20,
			},
			createRenderRepoMock(sampleRecord()),
		);

		expect(result.total).toBe(1);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
		expect(result.renders[0]?.renderId).toBe(API_RENDER_ID);
		expect(result.renders[0]?.idempotencyFingerprint).toBe("idem-hash-abc");
	});
});

describe("downloadRenderUseCase", () => {
	test("returns pdf bytes when checksum matches", async () => {
		const pdfBytes = new Uint8Array([37, 80, 68, 70]);
		const sha256 = createHash("sha256").update(pdfBytes).digest("hex");

		const record = sampleRecord({ sha256, byteSize: pdfBytes.byteLength });
		const result = await downloadRenderUseCase(
			{
				apiRenderId: API_RENDER_ID,
				workspaceId: WORKSPACE_ID,
			},
			{
				renderRepo: createRenderRepoMock(record),
				artifactStore: {
					async put() {
						throw new Error("unexpected put");
					},
					async get() {
						return pdfBytes;
					},
					async delete() {},
				},
			},
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.pdfBytes).toEqual(pdfBytes);
		expect(result.filename).toBe(`${API_RENDER_ID}.pdf`);
	});

	test("returns NOT_FOUND when artifact missing", async () => {
		const result = await downloadRenderUseCase(
			{
				apiRenderId: API_RENDER_ID,
				workspaceId: WORKSPACE_ID,
			},
			{
				renderRepo: createRenderRepoMock(sampleRecord()),
				artifactStore: {
					async put() {
						throw new Error("unexpected put");
					},
					async get() {
						return null;
					},
					async delete() {},
				},
			},
		);

		expect(result).toEqual({
			ok: false,
			code: "NOT_FOUND",
			message: "Render artifact not found",
		});
	});

	test("returns INTERNAL_ERROR on checksum mismatch", async () => {
		const result = await downloadRenderUseCase(
			{
				apiRenderId: API_RENDER_ID,
				workspaceId: WORKSPACE_ID,
			},
			{
				renderRepo: createRenderRepoMock(sampleRecord({ sha256: "deadbeef" })),
				artifactStore: {
					async put() {
						throw new Error("unexpected put");
					},
					async get() {
						return new Uint8Array([1, 2, 3]);
					},
					async delete() {},
				},
			},
		);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.code).toBe("INTERNAL_ERROR");
	});
});
