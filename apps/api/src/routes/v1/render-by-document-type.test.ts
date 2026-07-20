import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import type { RenderUseCaseDeps } from "@usetagih/core";
import { currentUsageMonth } from "@usetagih/core";
import {
	ApiErrorEnvelopeSchema,
	QUOTA_EXCEEDED_CODE,
	RATE_LIMITED_CODE,
} from "@usetagih/schema";
import missingBuyerInvoice from "../../../../../packages/schema/__fixtures__/invalid/structural/missing-buyer-invoice.json";
import invoiceMinimal from "../../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import { createApp } from "../../app.js";
import type { RenderRuntimeDeps } from "../../lib/render-deps.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { createInMemoryAuditRepo } from "../../test-helpers/audit.js";
import { initTestLogger } from "../../test-helpers/evlog.js";
import { createMemoryIdempotencyStore } from "../../test-helpers/idempotency-store.js";
import {
	createExhaustedQuotaRenderLimitsService,
	createTestRenderLimitsService,
} from "../../test-helpers/render-limits.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

const trialWorkspaceSettingsRepo = {
	getByOrganizationId: async () => ({
		tier: "trial" as const,
		branding: null,
	}),
};

function createMockRenderRuntime(
	overrides: Partial<RenderUseCaseDeps> = {},
): RenderRuntimeDeps {
	const baseDeps: RenderUseCaseDeps = {
		resolveLogoDeps: {
			ingestFromUrl: async () => {
				throw new Error("unexpected logo fetch");
			},
			getStoredLogo: async () => null,
			storeLogo: async () => {},
		},
		templateExists: (documentType, template) =>
			documentType === "invoice" && template === "modern",
		renderPdfFromPayload: () => ({
			pdfBytes: new Uint8Array([1, 2, 3, 4]),
			sha256: "mocksha256",
			byteSize: 4,
		}),
		renderRepo: {
			async insert(input) {
				return {
					...input,
					id: input.id ?? crypto.randomUUID(),
					createdAt: new Date(),
					updatedAt: new Date(),
				};
			},
			async getByIdAndWorkspace() {
				return null;
			},
			async getById() {
				return null;
			},
			async revokeShare() {
				return null;
			},
			async listByWorkspace() {
				return [];
			},
			async listByWorkspacePaginated() {
				return { items: [], total: 0 };
			},
		},
		artifactStore: {
			async put({ body }) {
				return { sha256: "mocksha256", byteSize: body.byteLength };
			},
			async get() {
				return null;
			},
			async delete() {},
		},
		shareSigningSecret: env.USETAGIH_SHARE_SIGNING_SECRET,
		generateRenderId: () => "00000000-0000-4000-8000-000000000099",
		generateShareNonce: () => "share-token-test",
		now: () => new Date("2026-07-20T00:00:00.000Z"),
		...overrides,
	};

	return {
		logoBlobStore: {} as RenderRuntimeDeps["logoBlobStore"],
		artifactStore: baseDeps.artifactStore,
		createRenderUseCaseDeps: () => baseDeps,
	};
}

describe("POST /v1/{documentType}/render", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();
	const auditRepo = createInMemoryAuditRepo();
	const { service: renderLimits } = createTestRenderLimitsService();

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			auditRepo,
			otelEnabled: false,
			idempotencyStore: createMemoryIdempotencyStore(),
			renderRuntime: createMockRenderRuntime(),
			workspaceSettingsRepo: trialWorkspaceSettingsRepo,
			resolveAuditUserId: async () => "00000000-0000-4000-8000-000000000001",
			renderLimits,
		});
	});

	async function bearerWithScope(scope: "renders:write" | "audit:read") {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: scope === "renders:write" ? ["renders:write"] : ["audit:read"],
		});
		return secret;
	}

	test("invoice render valid payload → 201 with Location and body", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "render-unit-test-key",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe(
			"/v1/renders/rnd_00000000-0000-4000-8000-000000000099",
		);
		const body = (await response.json()) as {
			renderId: string;
			status: string;
			shareUrl: string;
			expiresAt: string;
			schemaVersion: string;
			documentType: string;
			template: string;
		};
		expect(body.renderId.startsWith("rnd_")).toBe(true);
		expect(body.status).toBe("completed");
		expect(body.documentType).toBe("invoice");
		expect(body.template).toBe("modern");
		expect(body.shareUrl).toContain("/share/");
		expect(body.shareUrl.split("/share/")[1]).toContain(".");
		expect(auditRepo.events.some((event) => event.action === "render")).toBe(
			true,
		);
	});

	test("missing Idempotency-Key → 400 INVALID_REQUEST", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(400);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("INVALID_REQUEST");
	});

	test("quotation render with missing template → 400 INVALID_REQUEST", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/quotations/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "render-quotation-key",
				},
				body: JSON.stringify(quotationMinimal),
			}),
		);

		expect(response.status).toBe(400);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("INVALID_REQUEST");
		expect(body.error.details?.[0]?.path).toBe("/template");
	});

	test("invalid payload → 422 before render", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "render-invalid-key",
				},
				body: JSON.stringify(missingBuyerInvoice),
			}),
		);

		expect(response.status).toBe(422);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("VALIDATION_FAILED");
	});

	test("document type mismatch → 400", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "render-mismatch-key",
				},
				body: JSON.stringify({ ...invoiceMinimal, documentType: "quotation" }),
			}),
		);

		expect(response.status).toBe(400);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("DOCUMENT_TYPE_MISMATCH");
	});

	test("missing auth → 401", async () => {
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Idempotency-Key": "render-no-auth",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(401);
	});

	test("insufficient scope → 403", async () => {
		const secret = await bearerWithScope("audit:read");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "render-scope-key",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /v1/{documentType}/render limits", () => {
	const apiKeyRepo = createInMemoryApiKeyRepo();
	const auditRepo = createInMemoryAuditRepo();
	const fixedNow = () => new Date("2026-07-20T12:00:00.000Z");

	async function createBearer(workspaceId = crypto.randomUUID()) {
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["renders:write"],
		});
		return { secret, workspaceId };
	}

	function createLimitsApp(
		renderLimits: ReturnType<typeof createTestRenderLimitsService>["service"],
	) {
		return createApp({
			env,
			apiKeyRepo,
			auditRepo,
			otelEnabled: false,
			idempotencyStore: createMemoryIdempotencyStore(),
			renderRuntime: createMockRenderRuntime(),
			workspaceSettingsRepo: trialWorkspaceSettingsRepo,
			resolveAuditUserId: async () => "00000000-0000-4000-8000-000000000001",
			renderLimits,
		});
	}

	test("rate limit exceeded → 429 RATE_LIMITED with Retry-After", async () => {
		const { service: renderLimits } = createTestRenderLimitsService({
			now: fixedNow,
		});
		const app = createLimitsApp(renderLimits);
		const { secret } = await createBearer();

		for (let i = 0; i < 30; i += 1) {
			const okResponse = await app.handle(
				new Request("http://localhost/v1/invoices/render", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
						"Idempotency-Key": `rate-limit-ok-${i}`,
					},
					body: JSON.stringify(invoiceMinimal),
				}),
			);
			expect(okResponse.status).toBe(201);
		}

		const blocked = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "rate-limit-blocked",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("Retry-After")).not.toBeNull();
		const body = ApiErrorEnvelopeSchema.parse(await blocked.json());
		expect(body.error.code).toBe(RATE_LIMITED_CODE);
	});

	test("monthly quota exceeded → 402 QUOTA_EXCEEDED naming tier and next tier", async () => {
		const workspaceId = crypto.randomUUID();
		const { service, primeQuota } = createExhaustedQuotaRenderLimitsService({
			tier: "trial",
			now: fixedNow,
		});
		await primeQuota(workspaceId);

		const app = createLimitsApp(service);
		const { secret } = await createBearer(workspaceId);

		const response = await app.handle(
			new Request("http://localhost/v1/invoices/render", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
					"Idempotency-Key": "quota-exceeded-key",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(402);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe(QUOTA_EXCEEDED_CODE);
		expect(body.error.message).toContain("trial");
		expect(body.error.message).toContain("starter");
		expect(body.error.details?.some((detail) => detail.path === "/tier")).toBe(
			true,
		);
		expect(
			body.error.details?.some((detail) => detail.path === "/nextTier"),
		).toBe(true);
	});

	test("idempotent retry with same key does not double-count quota", async () => {
		const { service: renderLimits, usageCounterRepo } =
			createTestRenderLimitsService({ now: fixedNow });
		const app = createLimitsApp(renderLimits);
		const workspaceId = crypto.randomUUID();
		const { secret } = await createBearer(workspaceId);
		const month = currentUsageMonth(fixedNow());

		const requestInit = {
			method: "POST" as const,
			headers: {
				Authorization: `Bearer ${secret}`,
				"Content-Type": "application/json",
				"Idempotency-Key": "quota-idempotent-key",
			},
			body: JSON.stringify(invoiceMinimal),
		};

		const first = await app.handle(
			new Request("http://localhost/v1/invoices/render", requestInit),
		);
		expect(first.status).toBe(201);
		const firstBody = (await first.json()) as { renderId: string };

		const second = await app.handle(
			new Request("http://localhost/v1/invoices/render", requestInit),
		);
		expect(second.status).toBe(201);
		const secondBody = (await second.json()) as { renderId: string };
		expect(secondBody.renderId).toBe(firstBody.renderId);

		expect(await usageCounterRepo.getRenderCount({ workspaceId, month })).toBe(
			1,
		);
	});
});
