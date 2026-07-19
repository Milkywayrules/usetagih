import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	loadManifest,
	ManifestParseError,
	parseFixtureEntry,
} from "./manifest";

const PACKAGE_ROOT = resolve(import.meta.dir, "../..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

test("loadManifest parses real manifest.json", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	expect(manifest.fixtures.length).toBeGreaterThan(0);
	expect(manifest.fixtures[0]?.id).toBe("invoice-modern-basic");
	expect(manifest.fixtures[0]?.sha256).toBe(
		"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
	);
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
