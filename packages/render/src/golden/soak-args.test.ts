import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadManifest } from "./manifest";
import {
	detectSoakHashDrift,
	formatSoakDriftReport,
	parseGoldenSoakArgs,
	resolveSoakEntries,
	UnknownFixtureError,
} from "./soak-args";

const PACKAGE_ROOT = resolve(import.meta.dir, "../..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

test("parseGoldenSoakArgs defaults to 5 iterations and all fixtures", () => {
	expect(parseGoldenSoakArgs([])).toEqual({ iterations: 5, fixtureIds: [] });
});

test("parseGoldenSoakArgs parses --iterations and repeatable --fixture", () => {
	expect(
		parseGoldenSoakArgs([
			"--iterations",
			"100",
			"--fixture",
			"invoice-modern-basic",
			"--fixture",
			"invoice-modern-pagination-25",
		]),
	).toEqual({
		iterations: 100,
		fixtureIds: ["invoice-modern-basic", "invoice-modern-pagination-25"],
	});

	expect(
		parseGoldenSoakArgs([
			"--iterations",
			"10",
			"--fixture",
			"invoice-modern-basic",
		]),
	).toEqual({
		iterations: 10,
		fixtureIds: ["invoice-modern-basic"],
	});
});

test("parseGoldenSoakArgs rejects invalid iterations", () => {
	expect(() => parseGoldenSoakArgs(["--iterations", "0"])).toThrow(
		"invalid iterations",
	);
	expect(() => parseGoldenSoakArgs(["--iterations", "-1"])).toThrow(
		"invalid iterations",
	);
	expect(() => parseGoldenSoakArgs(["--iterations", "abc"])).toThrow(
		"invalid iterations",
	);
	expect(() => parseGoldenSoakArgs(["--iterations", "1.5"])).toThrow(
		"invalid iterations",
	);
	expect(() => parseGoldenSoakArgs(["--iterations"])).toThrow(
		"invalid iterations",
	);
});

test("parseGoldenSoakArgs rejects --fixture without value or flag-as-value", () => {
	expect(() => parseGoldenSoakArgs(["--fixture"])).toThrow("invalid fixture");
	expect(() => parseGoldenSoakArgs(["--fixture", "--iterations"])).toThrow(
		"invalid fixture",
	);
});

test("detectSoakHashDrift reports mismatch and formatSoakDriftReport matches contract", () => {
	expect(
		detectSoakHashDrift("invoice-modern-basic", 1, null, "abc"),
	).toBeNull();
	expect(
		detectSoakHashDrift("invoice-modern-basic", 2, "abc", "abc"),
	).toBeNull();

	const drift = detectSoakHashDrift(
		"invoice-modern-basic",
		42,
		"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
		"deadbeef",
	);
	expect(drift).toEqual({
		fixtureId: "invoice-modern-basic",
		iteration: 42,
		firstHash:
			"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
		actualHash: "deadbeef",
	});
	expect(formatSoakDriftReport(drift!)).toBe(
		[
			"FAIL invoice-modern-basic",
			"  drift at iteration 42",
			"  first hash: b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
			"  actual: deadbeef",
		].join("\n"),
	);
});

test("resolveSoakEntries returns all manifest fixtures when fixtureIds empty", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	const entries = resolveSoakEntries(manifest, []);
	expect(entries).toEqual(manifest.fixtures);
	expect(entries.length).toBeGreaterThanOrEqual(5);
});

test("resolveSoakEntries filters to requested fixture ids", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	const entries = resolveSoakEntries(manifest, [
		"invoice-modern-basic",
		"invoice-modern-pagination-25",
	]);
	expect(entries.map((entry) => entry.id)).toEqual([
		"invoice-modern-basic",
		"invoice-modern-pagination-25",
	]);
});

test("resolveSoakEntries dedupes duplicate fixture ids", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	const entries = resolveSoakEntries(manifest, [
		"invoice-modern-basic",
		"invoice-modern-basic",
	]);
	expect(entries).toHaveLength(1);
	expect(entries[0]?.id).toBe("invoice-modern-basic");
});

test("resolveSoakEntries throws UnknownFixtureError for unknown id", () => {
	const manifest = loadManifest(MANIFEST_PATH);
	expect(() => resolveSoakEntries(manifest, ["does-not-exist"])).toThrow(
		UnknownFixtureError,
	);

	try {
		resolveSoakEntries(manifest, ["does-not-exist"]);
	} catch (error) {
		expect(error).toBeInstanceOf(UnknownFixtureError);
		const fixtureError = error as UnknownFixtureError;
		expect(fixtureError.unknownId).toBe("does-not-exist");
		expect(fixtureError.validIds.length).toBeGreaterThanOrEqual(5);
	}
});
