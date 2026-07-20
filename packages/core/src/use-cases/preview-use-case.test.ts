import { expect, test } from "bun:test";
import type { DocumentPayload } from "@usetagih/schema";
import { previewUseCase } from "./preview-use-case.js";

const VALID_INVOICE: DocumentPayload = {
	schemaVersion: "2026-07-20",
	documentType: "invoice",
	template: "modern",
	documentNumber: "INV-1",
	issuedAt: "2026-07-20",
	dueAt: "2026-08-20",
	currency: "USD",
	seller: { name: "Seller" },
	buyer: { name: "Buyer" },
	lineItems: [
		{
			description: "Line",
			quantity: 1,
			unitPrice: { amount: "10.00" },
			lineTotal: { amount: "10.00" },
		},
	],
	totals: {
		subtotal: { amount: "10.00" },
		taxTotal: { amount: "0.00" },
		grandTotal: { amount: "10.00" },
	},
};

test("previewUseCase returns validation failure before render", async () => {
	const result = await previewUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: { documentType: "invoice" },
			workspaceId: "ws-1",
			workspaceTier: "trial",
		},
		{
			resolveLogoDeps: {
				ingestFromUrl: async () => {
					throw new Error("should not fetch");
				},
				getStoredLogo: async () => null,
				storeLogo: async () => {},
			},
			templateExists: () => true,
			renderPreviewFromPayload: () => {
				throw new Error("should not render");
			},
		},
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("VALIDATION_FAILED");
	}
});

test("previewUseCase returns template unavailable when typ file missing", async () => {
	const result = await previewUseCase(
		{
			pathDocumentType: "quotation",
			rawPayload: {
				schemaVersion: "2026-07-20",
				documentType: "quotation",
				template: "modern",
				documentNumber: "QUO-1",
				issuedAt: "2026-07-20",
				validUntil: "2026-09-20",
				currency: "USD",
				seller: { name: "Seller" },
				buyer: { name: "Buyer" },
				lineItems: [
					{
						description: "Line",
						quantity: 1,
						unitPrice: { amount: "10.00" },
						lineTotal: { amount: "10.00" },
					},
				],
				totals: {
					subtotal: { amount: "10.00" },
					taxTotal: { amount: "0.00" },
					grandTotal: { amount: "10.00" },
				},
			},
			workspaceId: "ws-1",
			workspaceTier: "trial",
		},
		{
			resolveLogoDeps: {
				ingestFromUrl: async () => {
					throw new Error("should not fetch");
				},
				getStoredLogo: async () => null,
				storeLogo: async () => {},
			},
			templateExists: () => false,
			renderPreviewFromPayload: () => {
				throw new Error("should not render");
			},
		},
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("INVALID_REQUEST");
		expect(result.details[0]?.path).toBe("/template");
	}
});

test("previewUseCase returns preview payload on success", async () => {
	let rendered = false;
	const result = await previewUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: VALID_INVOICE,
			workspaceId: "ws-1",
			workspaceTier: "pro",
		},
		{
			resolveLogoDeps: {
				ingestFromUrl: async () => {
					throw new Error("no logo");
				},
				getStoredLogo: async () => null,
				storeLogo: async () => {},
			},
			templateExists: () => true,
			renderPreviewFromPayload: () => {
				rendered = true;
				return {
					pageCount: 1,
					pages: [{ index: 1, svg: "<svg></svg>" }],
					html: '<div class="page" data-page="1"><svg></svg></div>',
				};
			},
		},
	);

	expect(rendered).toBe(true);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.pageCount).toBe(1);
		expect(result.html).toContain('data-page="1"');
	}
});
