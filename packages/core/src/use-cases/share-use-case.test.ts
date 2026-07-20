import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type {
	ArtifactStore,
	RenderRecord,
	RenderRepo,
} from "../ports/index.js";
import { computeShareExpiresAt, createShareToken } from "../share-token.js";
import {
	downloadShareUseCase,
	resolveShareUseCase,
} from "./resolve-share-use-case.js";
import { revokeShareUseCase } from "./revoke-share-use-case.js";

const SECRET = "dev-only-share-signing-secret-min-32-chars";
const RENDER_ID = "00000000-0000-4000-8000-000000000099";
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-07-20T00:00:00.000Z");
const EXPIRES_AT = computeShareExpiresAt(NOW, 90);

const PDF_BYTES = new Uint8Array([1, 2, 3]);
const PDF_SHA256 = createHash("sha256").update(PDF_BYTES).digest("hex");

function createRecord(overrides: Partial<RenderRecord> = {}): RenderRecord {
	const token =
		overrides.shareToken ??
		createShareToken({
			renderId: RENDER_ID,
			expiresAt: EXPIRES_AT,
			secret: SECRET,
			nonce: "nonce",
		});

	return {
		id: RENDER_ID,
		workspaceId: WORKSPACE_ID,
		documentType: "invoice",
		template: "modern",
		schemaVersion: "2026-07-20",
		status: "completed",
		payloadHash: "hash",
		resolvedTier: "trial",
		showWatermark: true,
		r2Key: "renders/key.pdf",
		sha256: PDF_SHA256,
		byteSize: 3,
		shareToken: token,
		shareExpiresAt: EXPIRES_AT,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function createRepo(record: RenderRecord | null): RenderRepo {
	return {
		async insert() {
			throw new Error("unexpected insert");
		},
		async getByIdAndWorkspace() {
			return null;
		},
		async getById(id) {
			return id === record?.id ? record : null;
		},
		async listByWorkspace() {
			return [];
		},
		async listByWorkspacePaginated() {
			return { items: [], total: 0 };
		},
		async revokeShare(renderId, workspaceId) {
			if (
				!record ||
				record.id !== renderId ||
				record.workspaceId !== workspaceId
			) {
				return null;
			}
			return { ...record, shareToken: null };
		},
	};
}

function createArtifactStore(pdf = PDF_BYTES): ArtifactStore {
	return {
		async put() {
			return { sha256: PDF_SHA256, byteSize: pdf.byteLength };
		},
		async get() {
			return pdf;
		},
		async delete() {},
	};
}

test("resolveShareUseCase returns metadata and downloadUrl", async () => {
	const record = createRecord();
	const token = record.shareToken as string;
	const result = await resolveShareUseCase(
		{
			token,
			shareSigningSecret: SECRET,
			now: NOW,
		},
		createRepo(record),
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.metadata.renderId).toBe(`rnd_${RENDER_ID}`);
		expect(result.metadata.documentType).toBe("invoice");
		expect(result.metadata.downloadUrl).toContain("/v1/share/");
		expect(result.metadata.downloadUrl).toContain("/download");
	}
});

test("resolveShareUseCase rejects expired token", async () => {
	const record = createRecord();
	const token = record.shareToken as string;
	const result = await resolveShareUseCase(
		{
			token,
			shareSigningSecret: SECRET,
			now: new Date("2027-01-01T00:00:00.000Z"),
		},
		createRepo(record),
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("EXPIRED");
	}
});

test("resolveShareUseCase rejects revoked share", async () => {
	const record = createRecord({ shareToken: null, shareExpiresAt: EXPIRES_AT });
	const token = createShareToken({
		renderId: RENDER_ID,
		expiresAt: EXPIRES_AT,
		secret: SECRET,
	});
	const result = await resolveShareUseCase(
		{
			token,
			shareSigningSecret: SECRET,
			now: NOW,
		},
		createRepo(record),
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("REVOKED");
	}
});

test("downloadShareUseCase returns pdf bytes", async () => {
	const record = createRecord();
	const token = record.shareToken as string;
	const result = await downloadShareUseCase(
		{
			token,
			shareSigningSecret: SECRET,
			now: NOW,
		},
		{
			renderRepo: createRepo(record),
			artifactStore: createArtifactStore(),
		},
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.pdfBytes.byteLength).toBe(3);
	}
});

test("revokeShareUseCase clears share token", async () => {
	const record = createRecord();
	const result = await revokeShareUseCase(
		{
			apiRenderId: `rnd_${RENDER_ID}`,
			workspaceId: WORKSPACE_ID,
		},
		createRepo(record),
	);

	expect(result.ok).toBe(true);
});
