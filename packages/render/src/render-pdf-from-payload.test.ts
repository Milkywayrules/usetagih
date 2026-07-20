import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import type { DocumentPayload } from "@usetagih/schema";
import { loadManifest } from "./golden/manifest";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "./golden/render-fixture";
import { renderPdfFromPayload } from "./render-pdf-from-payload";
import { resolveTypstBinaryPath } from "./typst-driver";

const typstAvailable = existsSync(resolveTypstBinaryPath());
const pdfTest = typstAvailable
	? (name: string, fn: () => void | Promise<void>) => test(name, fn, 30_000)
	: test.skip;

const BASIC_FIXTURE = "invoice-modern-basic";

if (!typstAvailable) {
	test("typst binary missing — render-pdf-from-payload tests skipped", () => {
		console.warn(
			`Skipping render-pdf-from-payload tests: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}

pdfTest("renderPdfFromPayload matches golden fixture sha256", async () => {
	const manifest = loadManifest(`${PACKAGE_ROOT}/manifest.json`);
	const entry = manifest.fixtures.find((f) => f.id === BASIC_FIXTURE);
	if (!entry) {
		throw new Error(`fixture not found: ${BASIC_FIXTURE}`);
	}

	const payload = JSON.parse(
		await Bun.file(`${PACKAGE_ROOT}/${entry.payload}`).text(),
	) as DocumentPayload;

	const golden = renderFixtureFromManifest({
		...entry,
		inputs: { ...entry.inputs, tier: "free" },
	});

	const rendered = renderPdfFromPayload({
		payload,
		workspaceTier: "trial",
		logo: null,
	});

	expect(rendered.sha256).toBe(golden.sha256);
	expect(rendered.byteSize).toBeGreaterThan(1000);
	expect(rendered.pdfBytes.byteLength).toBe(rendered.byteSize);
});
