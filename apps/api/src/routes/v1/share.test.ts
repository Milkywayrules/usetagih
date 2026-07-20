import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { parseEnv } from "@usetagih/config/env";
import {
	type ArtifactStore,
	buildShareUrl,
	computeShareExpiresAt,
	createShareToken,
	type RenderRecord,
	type RenderRepo,
} from "@usetagih/core";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import { createApp } from "../../app.js";
import { createRenderRuntimeDeps } from "../../lib/render-deps.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });
const SHARE_SECRET = env.USETAGIH_SHARE_SIGNING_SECRET;
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000010";
const RENDER_UUID = "00000000-0000-4000-8000-000000000099";
const API_RENDER_ID = `rnd_${RENDER_UUID}`;
const EXPIRES_AT = computeShareExpiresAt(
	new Date("2026-07-20T00:00:00.000Z"),
	90,
);
const SHARE_TOKEN = createShareToken({
	renderId: RENDER_UUID,
	expiresAt: EXPIRES_AT,
	secret: SHARE_SECRET,
	nonce: "public-share-nonce",
});

const PDF_BYTES = new Uint8Array([37, 80, 68, 70]);
const PDF_SHA256 = createHash("sha256").update(PDF_BYTES).digest("hex");
const ARTIFACT_KEY = `renders/${WORKSPACE_ID}/${API_RENDER_ID}.pdf`;

function createArtifactStore(): ArtifactStore & {
	objects: Map<string, Uint8Array>;
} {
	return {
		objects: new Map<string, Uint8Array>([
			[`${WORKSPACE_ID}:${ARTIFACT_KEY}`, PDF_BYTES],
		]),
		async put({ workspaceId, key, body }) {
			this.objects.set(`${workspaceId}:${key}`, body);
			const sha256 = createHash("sha256").update(body).digest("hex");
			return { sha256, byteSize: body.byteLength };
		},
		async get({ workspaceId, key }) {
			return this.objects.get(`${workspaceId}:${key}`) ?? null;
		},
		async delete({ workspaceId, key }) {
			this.objects.delete(`${workspaceId}:${key}`);
		},
	};
}

function createShareRenderRepo(
	initialToken: string | null = SHARE_TOKEN,
): RenderRepo {
	let shareToken = initialToken;
	const record: RenderRecord = {
		id: RENDER_UUID,
		workspaceId: WORKSPACE_ID,
		documentType: "invoice",
		template: "modern",
		schemaVersion: "2026-07-20",
		status: "completed",
		payloadHash: "payload-hash",
		resolvedTier: "trial",
		showWatermark: true,
		idempotencyHash: null,
		r2Key: ARTIFACT_KEY,
		sha256: PDF_SHA256,
		byteSize: PDF_BYTES.byteLength,
		shareToken,
		shareExpiresAt: EXPIRES_AT,
		logoChecksum: null,
		brandingSnapshot: null,
		errorCode: null,
		createdAt: new Date("2026-07-20T00:00:00.000Z"),
		updatedAt: new Date("2026-07-20T00:00:00.000Z"),
	};

	return {
		async insert() {
			throw new Error("unexpected insert");
		},
		async getById(renderId) {
			return renderId === RENDER_UUID ? { ...record, shareToken } : null;
		},
		async getByIdAndWorkspace(renderId, workspaceId) {
			return renderId === RENDER_UUID && workspaceId === WORKSPACE_ID
				? { ...record, shareToken }
				: null;
		},
		async revokeShare(renderId, workspaceId) {
			if (renderId !== RENDER_UUID || workspaceId !== WORKSPACE_ID) {
				return null;
			}
			shareToken = null;
			return { ...record, shareToken: null, shareExpiresAt: null };
		},
		async listByWorkspace() {
			return [];
		},
		async listByWorkspacePaginated() {
			return { items: [], total: 0 };
		},
	};
}

function createShareApp(renderRepo: RenderRepo) {
	return createApp({
		env,
		otelEnabled: false,
		renderRepo,
		renderRuntime: createRenderRuntimeDeps({
			artifactStore: createArtifactStore(),
		}),
	});
}

describe("public share routes", () => {
	let app: ReturnType<typeof createApp>;

	beforeAll(() => {
		app = createShareApp(createShareRenderRepo());
	});

	test("GET /v1/share/{token} returns metadata without auth", async () => {
		const encoded = encodeURIComponent(SHARE_TOKEN);
		const response = await app.handle(
			new Request(`http://localhost/v1/share/${encoded}`),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			renderId: string;
			documentType: string;
			downloadUrl: string;
			status: string;
		};
		expect(body.renderId).toBe(API_RENDER_ID);
		expect(body.documentType).toBe("invoice");
		expect(body.status).toBe("active");
		expect(body.downloadUrl).toContain("/v1/share/");
		expect(body.downloadUrl).toContain("/download");
	});

	test("GET /v1/share/{token}/download returns pdf without auth", async () => {
		const encoded = encodeURIComponent(SHARE_TOKEN);
		const response = await app.handle(
			new Request(`http://localhost/v1/share/${encoded}/download`),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(bytes).toEqual(PDF_BYTES);
	});

	test("GET /v1/share/{token} rejects tampered signature", async () => {
		const tampered = `${SHARE_TOKEN.slice(0, -1)}x`;
		const response = await app.handle(
			new Request(`http://localhost/v1/share/${encodeURIComponent(tampered)}`),
		);

		expect(response.status).toBe(404);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("NOT_FOUND");
	});

	test("GET /v1/share/{token} returns 403 when expired", async () => {
		const pastToken = createShareToken({
			renderId: RENDER_UUID,
			expiresAt: new Date("2020-01-01T00:00:00.000Z"),
			secret: SHARE_SECRET,
		});
		const response = await app.handle(
			new Request(`http://localhost/v1/share/${encodeURIComponent(pastToken)}`),
		);
		expect(response.status).toBe(403);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("FORBIDDEN");
		expect(body.error.message).toContain("expired");
	});

	test("GET /v1/share/{token} returns 403 after revoke", async () => {
		const repo = createShareRenderRepo();
		const revokedApp = createShareApp(repo);
		await repo.revokeShare(RENDER_UUID, WORKSPACE_ID);

		const response = await revokedApp.handle(
			new Request(
				`http://localhost/v1/share/${encodeURIComponent(SHARE_TOKEN)}`,
			),
		);
		expect(response.status).toBe(403);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("FORBIDDEN");
		expect(body.error.message).toContain("revoked");
	});

	test("buildShareUrl matches web public route shape", () => {
		expect(buildShareUrl(env.USETAGIH_WEB_PUBLIC_URL, SHARE_TOKEN)).toContain(
			"/share/",
		);
	});
});
