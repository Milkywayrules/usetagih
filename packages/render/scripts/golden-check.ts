import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	buildMismatchReport,
	formatDriftReport,
	formatMismatchReport,
	goldenHashFilePath,
	loadManifest,
	readGoldenHashFile,
} from "../src/golden";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "../src/golden/render-fixture";

const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");
const UPDATE_BANNER = [
	"══════════════════════════════════════════════════════════════",
	"⚠  GOLDEN HASHES UPDATED — review diffs before commit",
	"⚠  PR must carry label: golden-update",
	"⚠  Do not run --update to silence CI without visual review",
	"══════════════════════════════════════════════════════════════",
].join("\n");

function atomicWriteFile(path: string, content: string): void {
	const tempPath = `${path}.tmp`;
	writeFileSync(tempPath, content, "utf8");
	renameSync(tempPath, path);
}

function parseArgs(argv: string[]): { update: boolean } {
	return { update: argv.includes("--update") };
}

function checkFixtures(): number {
	const manifest = loadManifest(MANIFEST_PATH);
	let exitCode = 0;

	for (const entry of manifest.fixtures) {
		const goldenFilePath = goldenHashFilePath(PACKAGE_ROOT, entry.id);
		let goldenFileHash: string;

		try {
			goldenFileHash = readGoldenHashFile(goldenFilePath);
		} catch (error) {
			console.error(
				`FAIL ${entry.id}\n  could not read golden hash file: ${error instanceof Error ? error.message : String(error)}`,
			);
			exitCode = 1;
			continue;
		}

		if (entry.sha256 !== goldenFileHash) {
			console.error(formatDriftReport(entry.id, entry.sha256, goldenFileHash));
			exitCode = 1;
			continue;
		}

		try {
			const render1 = renderFixtureFromManifest(entry);
			const render2 = renderFixtureFromManifest(entry, {
				outputPath: resolve(
					PACKAGE_ROOT,
					".tmp",
					`${entry.id}-check-rerun.pdf`,
				),
			});

			if (render1.sha256 !== entry.sha256) {
				const report = buildMismatchReport({
					fixtureId: entry.id,
					expectedManifest: entry.sha256,
					expectedGoldenFile: goldenFileHash,
					actual: render1.sha256,
					render1Bytes: render1.pdfBytes,
					render2Bytes: render2.pdfBytes,
					render2Hash: render2.sha256,
				});
				console.error(formatMismatchReport(report));
				exitCode = 1;
			} else if (render1.sha256 !== render2.sha256) {
				const report = buildMismatchReport({
					fixtureId: entry.id,
					expectedManifest: entry.sha256,
					actual: render1.sha256,
					render1Bytes: render1.pdfBytes,
					render2Bytes: render2.pdfBytes,
					render2Hash: render2.sha256,
				});
				console.error(formatMismatchReport(report));
				exitCode = 1;
			} else {
				console.log(`PASS ${entry.id}: ${render1.sha256}`);
			}
		} catch (error) {
			console.error(
				`FAIL ${entry.id}\n  render error: ${error instanceof Error ? error.message : String(error)}`,
			);
			exitCode = 1;
		}
	}

	return exitCode;
}

function updateFixtures(): number {
	const manifestRaw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<
		string,
		unknown
	>;
	const manifest = loadManifest(MANIFEST_PATH);

	for (const entry of manifest.fixtures) {
		const { sha256 } = renderFixtureFromManifest(entry);
		const goldenFilePath = goldenHashFilePath(PACKAGE_ROOT, entry.id);
		atomicWriteFile(goldenFilePath, `${sha256}\n`);

		const fixtures = manifestRaw.fixtures as Array<Record<string, unknown>>;
		const target = fixtures.find((f) => f.id === entry.id);
		if (target) {
			target.sha256 = sha256;
		}

		console.log(`UPDATED ${entry.id}: ${sha256}`);
	}

	atomicWriteFile(
		MANIFEST_PATH,
		`${JSON.stringify(manifestRaw, null, "\t")}\n`,
	);

	console.error(UPDATE_BANNER);
	return 0;
}

const { update } = parseArgs(process.argv.slice(2));
const exitCode = update ? updateFixtures() : checkFixtures();
process.exit(exitCode);
