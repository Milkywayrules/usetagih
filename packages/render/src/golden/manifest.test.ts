import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	goldenHashFilePath,
	loadManifest,
	ManifestParseError,
	parseFixtureEntry,
	readGoldenHashFile,
} from "./manifest";

const PACKAGE_ROOT = resolve(import.meta.dir, "../..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

const LOGO_FIXTURE_IDS = [
	"invoice-modern-logo-png",
	"invoice-modern-logo-jpeg",
	"invoice-modern-logo-svg",
] as const;

test("loadManifest parses real manifest.json", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	expect(manifest.fixtures.length).toBeGreaterThanOrEqual(5);

	const basic = manifest.fixtures.find((f) => f.id === "invoice-modern-basic");
	const pagination = manifest.fixtures.find(
		(f) => f.id === "invoice-modern-pagination-25",
	);

	expect(basic).toBeDefined();
	expect(pagination).toBeDefined();

	const basicGolden = readGoldenHashFile(
		goldenHashFilePath(PACKAGE_ROOT, "invoice-modern-basic"),
	);
	const paginationGolden = readGoldenHashFile(
		goldenHashFilePath(PACKAGE_ROOT, "invoice-modern-pagination-25"),
	);

	expect(basic?.sha256).toBe(basicGolden);
	expect(pagination?.sha256).toBe(paginationGolden);
});

test("loadManifest includes logo fixture entries with matching golden files", () => {
	const manifest = loadManifest(MANIFEST_PATH);

	for (const id of LOGO_FIXTURE_IDS) {
		const entry = manifest.fixtures.find((f) => f.id === id);
		expect(entry).toBeDefined();
		expect(entry?.typstVersion).toBe("0.15.1");
		expect(entry?.schemaVersion).toBe("2026-07-20");
		expect(entry?.inputs.tier).toBe("free");
		expect(entry?.sha256).toMatch(/^[a-f0-9]{64}$/);

		const goldenHash = readGoldenHashFile(goldenHashFilePath(PACKAGE_ROOT, id));
		expect(entry?.sha256).toBe(goldenHash);
	}
});

test("loadManifest rejects missing fixtures array", () => {
	expect(() =>
		loadManifest(
			resolve(
				import.meta.dir,
				"../../__fixtures__/manifest-missing-fixtures.json",
			),
		),
	).toThrow(ManifestParseError);
});

test("parseFixtureEntry rejects invalid sha256 uppercase", () => {
	expect(() =>
		parseFixtureEntry(
			{
				id: "test",
				payload: "p.json",
				template: "t.typ",
				sha256:
					"B11BE4533D38F525326164B530A143BD71270440DC4B98F42CEC426F2D3A105C",
				typstVersion: "0.15.1",
				schemaVersion: "2026-07-20",
				inputs: { tier: "free" },
			},
			0,
		),
	).toThrow(/fixtures\[0\]\.sha256/);
});

test("parseFixtureEntry rejects invalid sha256 non-hex", () => {
	expect(() =>
		parseFixtureEntry(
			{
				id: "test",
				payload: "p.json",
				template: "t.typ",
				sha256: "GHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuv",
				typstVersion: "0.15.1",
				schemaVersion: "2026-07-20",
				inputs: { tier: "free" },
			},
			0,
		),
	).toThrow(/fixtures\[0\]\.sha256/);
});

test("parseFixtureEntry rejects missing inputs", () => {
	expect(() =>
		parseFixtureEntry(
			{
				id: "test",
				payload: "p.json",
				template: "t.typ",
				sha256:
					"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
				typstVersion: "0.15.1",
				schemaVersion: "2026-07-20",
			},
			0,
		),
	).toThrow(/fixtures\[0\]\.inputs/);
});
