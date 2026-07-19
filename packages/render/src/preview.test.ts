import { randomUUID } from "node:crypto";
import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { loadManifest } from "./golden/manifest";
import { buildTypstInputArgs, PACKAGE_ROOT } from "./golden/render-fixture";
import { renderPreview, renderPreviewFromManifest } from "./preview";
import { evalTypst, resolveTypstBinaryPath } from "./typst-driver";

const MANIFEST_PATH = join(PACKAGE_ROOT, "manifest.json");
const BASIC_FIXTURE = "invoice-modern-basic";
const PAGINATION_FIXTURE = "invoice-modern-pagination-25";

const typstAvailable = existsSync(resolveTypstBinaryPath());
const previewTest = typstAvailable ? test : test.skip;

function manifestEntry(fixture: string, tier: string) {
	const manifest = loadManifest(MANIFEST_PATH);
	const entry = manifest.fixtures.find((f) => f.id === fixture);
	if (!entry) {
		throw new Error(`fixture not in manifest: ${fixture}`);
	}
	return {
		...entry,
		inputs: { ...entry.inputs, tier },
	};
}

function getPdfPageCountFromManifest(fixture: string, tier: string): number {
	const entry = manifestEntry(fixture, tier);
	const templateAbs = resolve(PACKAGE_ROOT, entry.template);
	const payloadAbs = resolve(PACKAGE_ROOT, entry.payload);
	const extraArgs = buildTypstInputArgs(templateAbs, payloadAbs, entry.inputs);
	const raw = evalTypst({
		inputPath: templateAbs,
		expression: "query(<page-count>)",
		extraArgs,
	});
	const hits = JSON.parse(raw) as Array<{ value: number[] }>;
	return Number(hits[0]?.value?.[0]);
}

function testPreviewTempDir(label: string): string {
	return join(PACKAGE_ROOT, ".tmp", `preview-test-${label}-${randomUUID()}`);
}

if (!typstAvailable) {
	test("typst binary missing — preview tests skipped", () => {
		console.warn(
			`Skipping preview tests: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}

previewTest(
	"basic fixture preview has one page matching PDF page count",
	() => {
		const pdfPageCount = getPdfPageCountFromManifest(BASIC_FIXTURE, "free");
		const result = renderPreviewFromManifest(
			manifestEntry(BASIC_FIXTURE, "free"),
			"free",
		);

		expect(pdfPageCount).toBe(1);
		expect(result.pageCount).toBe(1);
		expect(result.pages).toHaveLength(1);
		expect(result.pages[0]?.index).toBe(1);
		expect(result.pageCount).toBe(pdfPageCount);
		expect(result.pages.map((page) => page.index)).toEqual([1]);
		expect(result.pages[0]?.svg).toMatch(/^<svg/i);
	},
);

previewTest(
	"pagination fixture preview has three pages matching PDF page count",
	() => {
		const pdfPageCount = getPdfPageCountFromManifest(
			PAGINATION_FIXTURE,
			"free",
		);
		const result = renderPreviewFromManifest(
			manifestEntry(PAGINATION_FIXTURE, "free"),
			"free",
		);

		expect(pdfPageCount).toBe(3);
		expect(result.pageCount).toBe(3);
		expect(result.pages).toHaveLength(3);
		expect(result.pages.map((page) => page.index)).toEqual([1, 2, 3]);
		expect(result.pageCount).toBe(pdfPageCount);
		for (const page of result.pages) {
			expect(page.svg).toMatch(/^<svg/i);
		}
	},
);

previewTest("renderPreview removes temp preview directory after return", () => {
	const previewTempDir = testPreviewTempDir("cleanup-success");
	renderPreviewFromManifest(manifestEntry(BASIC_FIXTURE, "free"), "free", {
		previewTempDir,
	});
	expect(existsSync(previewTempDir)).toBe(false);
});

previewTest(
	"renderPreview removes temp preview directory after compile failure",
	() => {
		const badDir = join(PACKAGE_ROOT, ".tmp", "fail-probe");
		mkdirSync(badDir, { recursive: true });
		const badTyp = join(badDir, "bad.typ");
		writeFileSync(badTyp, "#let x = {{{");
		const payloadAbs = resolve(
			PACKAGE_ROOT,
			manifestEntry(BASIC_FIXTURE, "free").payload,
		);
		const previewTempDir = testPreviewTempDir("cleanup-failure");

		expect(() =>
			renderPreview({
				templatePath: badTyp,
				payloadPath: payloadAbs,
				previewTempDir,
			}),
		).toThrow(/Typst compile failed|unclosed delimiter/i);

		expect(existsSync(previewTempDir)).toBe(false);
		rmSync(badDir, { recursive: true, force: true });
	},
);
