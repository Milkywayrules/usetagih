import { expect, test } from "bun:test";
import type { DocumentPayload } from "@usetagih/schema";
import type { ArtifactStore, RenderRepo } from "../ports/index.js";
import {
	buildShareUrl,
	computeShareExpiresAt,
	createShareToken,
} from "../share-token.js";
import { renderUseCase, SYNC_MAX_LINE_ITEMS } from "./render-use-case.js";

const SHARE_SECRET = "dev-only-share-signing-secret-min-32-chars";

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

function createDeps(
	overrides: {
		renderRepo?: RenderRepo;
		artifactStore?: ArtifactStore;
		renderPdfFromPayload?: () => {
			pdfBytes: Uint8Array;
			sha256: string;
			byteSize: number;
		};
	} = {},
) {
	const inserted: Array<Record<string, unknown>> = [];
	const artifacts = new Map<string, Uint8Array>();

	const renderRepo: RenderRepo =
		overrides.renderRepo ??
		({
			async insert(input) {
				inserted.push(input);
				return {
					...input,
					id: input.id ?? "00000000-0000-4000-8000-000000000001",
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
		} satisfies RenderRepo);

	const artifactStore: ArtifactStore =
		overrides.artifactStore ??
		({
			async put({ workspaceId, key, body }) {
				artifacts.set(`${workspaceId}:${key}`, body);
				return { sha256: "abc123", byteSize: body.byteLength };
			},
			async get({ workspaceId, key }) {
				return artifacts.get(`${workspaceId}:${key}`) ?? null;
			},
			async delete({ workspaceId, key }) {
				artifacts.delete(`${workspaceId}:${key}`);
			},
		} satisfies ArtifactStore);

	return {
		inserted,
		artifacts,
		deps: {
			resolveLogoDeps: {
				ingestFromUrl: async () => {
					throw new Error("should not fetch");
				},
				getStoredLogo: async () => null,
				storeLogo: async () => {},
			},
			templateExists: () => true,
			renderPdfFromPayload:
				overrides.renderPdfFromPayload ??
				(() => ({
					pdfBytes: new Uint8Array([1, 2, 3]),
					sha256: "deadbeef",
					byteSize: 3,
				})),
			renderRepo,
			artifactStore,
			shareSigningSecret: SHARE_SECRET,
			generateRenderId: () => "00000000-0000-4000-8000-000000000099",
			generateShareNonce: () => "fixed-nonce",
			now: () => new Date("2026-07-20T00:00:00.000Z"),
		},
	};
}

test("renderUseCase returns validation failure before render", async () => {
	const { deps } = createDeps();
	const result = await renderUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: { documentType: "invoice" },
			workspaceId: "ws-1",
			workspaceTier: "trial",
			webPublicUrl: "https://app.example.com",
		},
		deps,
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("VALIDATION_FAILED");
	}
});

test("renderUseCase rejects sync payloads over line item limit", async () => {
	const { deps } = createDeps();
	const lineItems = Array.from({ length: SYNC_MAX_LINE_ITEMS + 1 }, (_, i) => ({
		description: `Line ${i}`,
		quantity: 1,
		unitPrice: { amount: "1.00" },
		lineTotal: { amount: "1.00" },
	}));

	const result = await renderUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: {
				...VALID_INVOICE,
				lineItems,
				totals: {
					subtotal: { amount: "101.00" },
					taxTotal: { amount: "0.00" },
					grandTotal: { amount: "101.00" },
				},
			},
			workspaceId: "ws-1",
			workspaceTier: "trial",
			webPublicUrl: "https://app.example.com",
		},
		deps,
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("INVALID_REQUEST");
		expect(result.details[0]?.path).toBe("/lineItems");
	}
});

test("renderUseCase persists completed render with snapshots", async () => {
	let rendered = false;
	const { deps, inserted, artifacts } = createDeps({
		renderPdfFromPayload: () => {
			rendered = true;
			return {
				pdfBytes: new Uint8Array([9, 9, 9]),
				sha256: "pdfhash",
				byteSize: 3,
			};
		},
	});

	const result = await renderUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: VALID_INVOICE,
			workspaceId: "ws-1",
			workspaceTier: "trial",
			idempotencyHash: "idem-hash",
			webPublicUrl: "https://app.example.com/",
		},
		deps,
	);

	expect(rendered).toBe(true);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.renderId).toBe("rnd_00000000-0000-4000-8000-000000000099");
		const expectedToken = createShareToken({
			renderId: "00000000-0000-4000-8000-000000000099",
			expiresAt: computeShareExpiresAt(
				new Date("2026-07-20T00:00:00.000Z"),
				90,
			),
			secret: SHARE_SECRET,
			nonce: "fixed-nonce",
		});
		expect(result.shareUrl).toBe(
			buildShareUrl("https://app.example.com/", expectedToken),
		);
		expect(result.status).toBe("completed");
		expect(result.stages.totalMs).toBeGreaterThanOrEqual(0);
	}

	expect(inserted).toHaveLength(1);
	expect(inserted[0]?.showWatermark).toBe(true);
	expect(inserted[0]?.resolvedTier).toBe("trial");
	expect(inserted[0]?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
	expect(inserted[0]?.idempotencyHash).toBe("idem-hash");
	expect(inserted[0]?.r2Key).toBe(
		"renders/ws-1/rnd_00000000-0000-4000-8000-000000000099.pdf",
	);
	expect(
		artifacts.has(
			"ws-1:renders/ws-1/rnd_00000000-0000-4000-8000-000000000099.pdf",
		),
	).toBe(true);
});

test("renderUseCase maps paid tier to pro watermark off", async () => {
	const { deps, inserted } = createDeps();
	const result = await renderUseCase(
		{
			pathDocumentType: "invoice",
			rawPayload: VALID_INVOICE,
			workspaceId: "ws-1",
			workspaceTier: "pro",
			webPublicUrl: "https://app.example.com",
		},
		deps,
	);

	expect(result.ok).toBe(true);
	expect(inserted[0]?.showWatermark).toBe(false);
	expect(inserted[0]?.resolvedTier).toBe("pro");
});
