import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { parseEnv } from "@usetagih/config/env";
import type {
	ArtifactStore,
	AuditAppendInput,
	AuditRepo,
	RenderRecord,
	RenderRepo,
} from "@usetagih/core";
import { buildShareUrl } from "@usetagih/core";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import { createApp } from "../../app.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });
const WEB_PUBLIC_URL = env.USETAGIH_WEB_PUBLIC_URL.replace(/\/$/, "");

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000010";
const RENDER_UUID = "00000000-0000-4000-8000-000000000099";
const API_RENDER_ID = `rnd_${RENDER_UUID}`;
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000020";
const OTHER_RENDER_UUID = "00000000-0000-4000-8000-000000000088";
const OTHER_API_RENDER_ID = `rnd_${OTHER_RENDER_UUID}`;

const PDF_BYTES = new Uint8Array([37, 80, 68, 70]);
const PDF_SHA256 = createHash("sha256").update(PDF_BYTES).digest("hex");
const ARTIFACT_KEY = `renders/${WORKSPACE_ID}/${API_RENDER_ID}.pdf`;

function sampleRecord(
	workspaceId: string,
	id: string,
	apiRenderId: string,
): RenderRecord {
	return {
		id,
		workspaceId,
		documentType: "invoice",
		template: "modern",
		schemaVersion: "2026-07-20",
		status: "completed",
		payloadHash: "payload-hash",
		resolvedTier: "trial",
		showWatermark: true,
		idempotencyHash: "idem-hash",
		r2Key: `renders/${workspaceId}/${apiRenderId}.pdf`,
		sha256: PDF_SHA256,
		byteSize: PDF_BYTES.byteLength,
		shareToken: "share-token-test",
		shareExpiresAt: new Date("2026-10-18T00:00:00.000Z"),
		logoChecksum: null,
		brandingSnapshot: null,
		errorCode: null,
		createdAt: new Date("2026-07-20T00:00:00.000Z"),
		updatedAt: new Date("2026-07-20T00:00:00.000Z"),
	};
}

function createRenderRepoFixture(): RenderRepo {
	const records = [
		sampleRecord(WORKSPACE_ID, RENDER_UUID, API_RENDER_ID),
		sampleRecord(OTHER_WORKSPACE_ID, OTHER_RENDER_UUID, OTHER_API_RENDER_ID),
	];

	return {
		async insert(input) {
			const id = input.id ?? crypto.randomUUID();
			const record = {
				...input,
				id,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			records.push(record);
			return record;
		},
		async getByIdAndWorkspace(renderId, workspaceId) {
			return (
				records.find(
					(record) =>
						record.id === renderId && record.workspaceId === workspaceId,
				) ?? null
			);
		},
		async getById(renderId) {
			return records.find((record) => record.id === renderId) ?? null;
		},
		async revokeShare(renderId, workspaceId) {
			const index = records.findIndex(
				(record) =>
					record.id === renderId && record.workspaceId === workspaceId,
			);
			if (index < 0) {
				return null;
			}
			records[index] = {
				...records[index],
				shareToken: null,
				shareExpiresAt: null,
			};
			return records[index];
		},
		async listByWorkspace(workspaceId, limit = 50) {
			return records
				.filter((record) => record.workspaceId === workspaceId)
				.slice(0, limit);
		},
		async listByWorkspacePaginated(workspaceId, query) {
			const filtered = records.filter((record) => {
				if (record.workspaceId !== workspaceId) {
					return false;
				}
				if (query.documentType && record.documentType !== query.documentType) {
					return false;
				}
				if (query.from && record.createdAt < query.from) {
					return false;
				}
				if (query.to && record.createdAt > query.to) {
					return false;
				}
				return true;
			});
			return {
				items: filtered.slice(query.offset, query.offset + query.limit),
				total: filtered.length,
			};
		},
	};
}

describe("GET /v1/renders routes", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();
	const renderRepo = createRenderRepoFixture();
	const artifactStore: ArtifactStore & {
		objects: Map<string, Uint8Array>;
	} = {
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
	const auditEvents: Array<{ action: string; resourceId?: string | null }> = [];
	const auditRepo: AuditRepo = {
		async append(input: AuditAppendInput) {
			auditEvents.push({
				action: input.action,
				resourceId: input.resourceId,
			});
			return { id: crypto.randomUUID() };
		},
		async listByWorkspacePaginated() {
			return { items: [], total: 0 };
		},
	};

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			otelEnabled: false,
			renderRepo,
			auditRepo,
			resolveAuditUserId: async () => "00000000-0000-4000-8000-000000000001",
			renderRuntime: {
				logoBlobStore: {} as never,
				artifactStore,
				createRenderUseCaseDeps: () => {
					throw new Error("render create not used in retrieval tests");
				},
			},
		});
	});

	async function bearerWithScope(scope: "renders:read" | "renders:write") {
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId: WORKSPACE_ID,
			scopes: [scope],
		});
		return secret;
	}

	test("GET /v1/renders returns paginated metadata", async () => {
		const secret = await bearerWithScope("renders:read");
		const response = await app.handle(
			new Request("http://localhost/v1/renders?page=1&pageSize=20", {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.total).toBe(1);
		expect(body.renders[0].renderId).toBe(API_RENDER_ID);
		expect(body.renders[0].idempotencyFingerprint).toBe("idem-hash");
		expect(body.renders[0].shareUrl).toBe(
			buildShareUrl(WEB_PUBLIC_URL, "share-token-test"),
		);
	});

	test("GET /v1/renders/{renderId} returns metadata", async () => {
		const secret = await bearerWithScope("renders:read");
		const response = await app.handle(
			new Request(`http://localhost/v1/renders/${API_RENDER_ID}`, {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.renderId).toBe(API_RENDER_ID);
		expect(body.status).toBe("completed");
	});

	test("GET /v1/renders/{renderId} cross-workspace → 404", async () => {
		const secret = await bearerWithScope("renders:read");
		const response = await app.handle(
			new Request(`http://localhost/v1/renders/${OTHER_API_RENDER_ID}`, {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);
		expect(response.status).toBe(404);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("NOT_FOUND");
	});

	test("GET /v1/renders/{renderId}/download returns pdf with headers", async () => {
		const secret = await bearerWithScope("renders:read");
		const response = await app.handle(
			new Request(`http://localhost/v1/renders/${API_RENDER_ID}/download`, {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
		expect(response.headers.get("Content-Disposition")).toContain(
			`attachment; filename="${API_RENDER_ID}.pdf"`,
		);
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(bytes).toEqual(PDF_BYTES);
		expect(
			auditEvents.some((event) => event.action === "render.download"),
		).toBe(true);
	});

	test("DELETE /v1/renders/{renderId}/share revokes share link", async () => {
		const writeSecret = await bearerWithScope("renders:write");
		const revokeResponse = await app.handle(
			new Request(`http://localhost/v1/renders/${API_RENDER_ID}/share`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${writeSecret}` },
			}),
		);
		expect(revokeResponse.status).toBe(200);
		const revokeBody = (await revokeResponse.json()) as {
			renderId: string;
			revoked: boolean;
		};
		expect(revokeBody.renderId).toBe(API_RENDER_ID);
		expect(revokeBody.revoked).toBe(true);
		expect(auditEvents.some((event) => event.action === "share.revoke")).toBe(
			true,
		);

		const readSecret = await bearerWithScope("renders:read");
		const metadataResponse = await app.handle(
			new Request(`http://localhost/v1/renders/${API_RENDER_ID}`, {
				headers: { Authorization: `Bearer ${readSecret}` },
			}),
		);
		expect(metadataResponse.status).toBe(200);
		const metadata = (await metadataResponse.json()) as {
			shareUrl: string | null;
		};
		expect(metadata.shareUrl).toBeNull();
	});

	test("insufficient scope → 403", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request(`http://localhost/v1/renders/${API_RENDER_ID}`, {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);
		expect(response.status).toBe(403);
	});
});
