export {
	buildMismatchReport,
	compareSha256,
	formatDriftReport,
	formatHexDiff,
	formatMismatchReport,
	HEX_DIFF_BYTES,
	type MismatchReport,
	type MismatchReportInput,
	type Sha256CompareResult,
} from "./hash-compare";
export {
	type GoldenFixtureEntry,
	type GoldenManifest,
	goldenHashFilePath,
	loadManifest,
	ManifestParseError,
	parseFixtureEntry,
	readGoldenHashFile,
} from "./manifest";
export {
	PACKAGE_ROOT,
	type RenderFixtureOptions,
	type RenderFixtureResult,
	renderFixtureFromManifest,
} from "./render-fixture";
