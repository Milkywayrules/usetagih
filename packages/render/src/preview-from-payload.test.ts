import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import type { DocumentPayload } from "@usetagih/schema";
import { loadManifest } from "./golden/manifest";
import { PACKAGE_ROOT } from "./golden/render-fixture";
import { renderPreviewFromManifest } from "./preview";
import { renderPreviewFromPayload } from "./preview-from-payload";
import { resolveTypstBinaryPath } from "./typst-driver";

const typstAvailable = existsSync(resolveTypstBinaryPath());
const previewTest = typstAvailable
	? (name: string, fn: () => void | Promise<void>) => test(name, fn, 30_000)
	: test.skip;

const PAGINATION_FIXTURE = "invoice-modern-pagination-25";

if (!typstAvailable) {
	test("typst binary missing — preview-from-payload tests skipped", () => {
		console.warn(
			`Skipping preview-from-payload tests: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}

previewTest(
	"renderPreviewFromPayload pagination matches manifest PDF page count",
	async () => {
		const manifest = loadManifest(`${PACKAGE_ROOT}/manifest.json`);
		const entry = manifest.fixtures.find((f) => f.id === PAGINATION_FIXTURE);
		if (!entry) {
			throw new Error(`fixture not found: ${PAGINATION_FIXTURE}`);
		}

		const payload = JSON.parse(
			await Bun.file(`${PACKAGE_ROOT}/${entry.payload}`).text(),
		) as DocumentPayload;

		const manifestPreview = renderPreviewFromManifest(
			{ ...entry, inputs: { ...entry.inputs, tier: "free" } },
			"free",
		);

		const payloadPreview = renderPreviewFromPayload({
			payload,
			workspaceTier: "trial",
			logo: null,
		});

		expect(payloadPreview.pageCount).toBe(3);
		expect(payloadPreview.pageCount).toBe(manifestPreview.pageCount);
		expect(payloadPreview.pages.length).toBe(3);
		expect(payloadPreview.html).toContain('data-page="3"');
	},
);
