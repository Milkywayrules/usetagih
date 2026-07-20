import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import unsupportedSchemaVersion from "../../../../../packages/schema/__fixtures__/invalid/schema-version/unsupported-2025-01-01.json";
import missingBuyerInvoice from "../../../../../packages/schema/__fixtures__/invalid/structural/missing-buyer-invoice.json";
import invoiceMinimal from "../../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import receiptMinimal from "../../../../../packages/schema/__fixtures__/valid/receipt-minimal.json";
import { createApp } from "../../app.js";
import { signSessionBearerToken } from "../../auth/session-token.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

const validateCases = [
	{
		path: "/v1/invoices/validate",
		fixture: invoiceMinimal,
		documentType: "invoice" as const,
	},
	{
		path: "/v1/quotations/validate",
		fixture: quotationMinimal,
		documentType: "quotation" as const,
	},
	{
		path: "/v1/receipts/validate",
		fixture: receiptMinimal,
		documentType: "receipt" as const,
	},
] as const;

describe("POST /v1/{documentType}/validate", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();

	beforeAll(() => {
		app = createApp({ env, apiKeyRepo, otelEnabled: false });
	});

	async function bearerWithScope(scope: "renders:write" | "audit:read") {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: scope === "renders:write" ? ["renders:write"] : ["audit:read"],
		});
		return secret;
	}

	for (const row of validateCases) {
		test(`API key ${row.path} valid minimal fixture → 200`, async () => {
			const secret = await bearerWithScope("renders:write");
			const response = await app.handle(
				new Request(`http://localhost${row.path}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(row.fixture),
				}),
			);

			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				valid: boolean;
				normalizedPreview: { documentType: string; schemaVersion: string };
			};
			expect(body.valid).toBe(true);
			expect(body.normalizedPreview.documentType).toBe(row.documentType);
			expect(body.normalizedPreview.schemaVersion).toBe("2026-07-20");
		});
	}

	test("session bearer with renders:write → 200 on invoice validate", async () => {
		const signed = await signSessionBearerToken(
			{
				userId: crypto.randomUUID(),
				workspaceId: crypto.randomUUID(),
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${signed.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			valid: boolean;
			normalizedPreview: { documentType: string };
		};
		expect(body.valid).toBe(true);
		expect(body.normalizedPreview.documentType).toBe("invoice");
	});

	test("structural failure → 422 VALIDATION_FAILED envelope", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(missingBuyerInvoice),
			}),
		);

		expect(response.status).toBe(422);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("VALIDATION_FAILED");
		expect(envelope.error.details.length).toBeGreaterThan(0);
		expect(response.headers.get("X-Request-Id")).toBe(envelope.error.requestId);
	});

	test("document type mismatch → 400 DOCUMENT_TYPE_MISMATCH", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ...invoiceMinimal, documentType: "quotation" }),
			}),
		);

		expect(response.status).toBe(400);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("DOCUMENT_TYPE_MISMATCH");
		expect(envelope.error.details.some((d) => d.path === "/documentType")).toBe(
			true,
		);
	});

	test("unsupported schemaVersion → 400 UNSUPPORTED_SCHEMA_VERSION", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(unsupportedSchemaVersion),
			}),
		);

		expect(response.status).toBe(400);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
		expect(
			envelope.error.details.some((d) => d.path === "/schemaVersion"),
		).toBe(true);
	});

	test("unknown path segment → 404 NOT_FOUND", async () => {
		const secret = await bearerWithScope("renders:write");
		const response = await app.handle(
			new Request("http://localhost/v1/purchase-orders/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(404);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("NOT_FOUND");
	});

	test("unauthenticated → 401 UNAUTHORIZED", async () => {
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(401);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("UNAUTHORIZED");
	});

	test("insufficient scope → 403 FORBIDDEN", async () => {
		const secret = await bearerWithScope("audit:read");
		const response = await app.handle(
			new Request("http://localhost/v1/invoices/validate", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invoiceMinimal),
			}),
		);

		expect(response.status).toBe(403);
		const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(envelope.error.code).toBe("FORBIDDEN");
	});
});
