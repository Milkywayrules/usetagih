import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import type { RenderUseCaseDeps } from "@usetagih/core";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import missingBuyerInvoice from "../../../../../packages/schema/__fixtures__/invalid/structural/missing-buyer-invoice.json";
import invoiceMinimal from "../../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import { createApp } from "../../app.js";
import type { RenderRuntimeDeps } from "../../lib/render-deps.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { initTestLogger } from "../../test-helpers/evlog.js";
import { createMemoryIdempotencyStore } from "../../test-helpers/idempotency-store.js";

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
		generateRenderId: () => "00000000-0000-4000-8000-000000000099",
		generateShareToken: () => "share-token-test",
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

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			otelEnabled: false,
			idempotencyStore: createMemoryIdempotencyStore(),
			renderRuntime: createMockRenderRuntime(),
			workspaceSettingsRepo: trialWorkspaceSettingsRepo,
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
		expect(body.shareUrl).toContain("/share/share-token-test");
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
