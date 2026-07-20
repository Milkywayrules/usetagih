import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import type { PreviewUseCaseDeps } from "@usetagih/core";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import missingBuyerInvoice from "../../../../../packages/schema/__fixtures__/invalid/structural/missing-buyer-invoice.json";
import invoiceMinimal from "../../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import { createApp } from "../../app.js";
import type { PreviewRuntimeDeps } from "../../lib/preview-deps.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

const trialWorkspaceSettingsRepo = {
	getByOrganizationId: async () => ({
		tier: "trial" as const,
		branding: null,
	}),
};

function createMockPreviewRuntime(
	overrides: Partial<PreviewUseCaseDeps> = {},
): PreviewRuntimeDeps {
	const baseDeps: PreviewUseCaseDeps = {
		resolveLogoDeps: {
			ingestFromUrl: async () => {
				throw new Error("unexpected logo fetch");
			},
			getStoredLogo: async () => null,
			storeLogo: async () => {},
		},
		templateExists: (documentType, template) =>
			documentType === "invoice" && template === "modern",
		renderPreviewFromPayload: () => ({
			pageCount: 1,
			pages: [{ index: 1, svg: "<svg></svg>" }],
			html: '<div class="page" data-page="1"><svg></svg></div>',
		}),
		...overrides,
	};

	return {
		logoBlobStore: {} as PreviewRuntimeDeps["logoBlobStore"],
		createPreviewUseCaseDeps: () => baseDeps,
	};
}

describe("POST /v1/{documentType}/preview", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			otelEnabled: false,
			previewRuntime: createMockPreviewRuntime(),
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

	test("invoice preview valid payload → 200 preview body", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			valid: boolean;
			pageCount: number;
			pages: Array<{ index: number; svg: string }>;
			html: string;
		};
		expect(body.valid).toBe(true);
		expect(body.pageCount).toBe(1);
		expect(body.pages[0]?.svg).toBe("<svg></svg>");
		expect(body.html).toContain('data-page="1"');
	});

	test("quotation preview with missing template → 400 INVALID_REQUEST", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/quotations/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
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
			new Request("http://localhost/v1/invoices/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
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
			new Request("http://localhost/v1/invoices/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
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
			new Request("http://localhost/v1/invoices/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(401);
	});

	test("insufficient scope → 403", async () => {
		const secret = await bearerWithScope("audit:read");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(403);
	});
});
