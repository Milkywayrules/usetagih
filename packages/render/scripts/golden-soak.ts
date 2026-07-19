import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "../src/golden";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "../src/golden/render-fixture";
import {
	detectSoakHashDrift,
	formatSoakDriftReport,
	GOLDEN_SOAK_USAGE,
	parseGoldenSoakArgs,
	resolveSoakEntries,
	UnknownFixtureError,
} from "../src/golden/soak-args";

const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

function main(): number {
	let args: ReturnType<typeof parseGoldenSoakArgs>;
	try {
		args = parseGoldenSoakArgs(process.argv.slice(2));
	} catch {
		console.error(GOLDEN_SOAK_USAGE);
		process.exit(1);
	}

	const manifest = loadManifest(MANIFEST_PATH);
	let entries: ReturnType<typeof resolveSoakEntries>;
	try {
		entries = resolveSoakEntries(manifest, args.fixtureIds);
	} catch (error) {
		if (error instanceof UnknownFixtureError) {
			console.error(`unknown fixture: ${error.unknownId}`);
			console.error(`valid fixture ids: ${error.validIds.join(", ")}`);
			return 1;
		}
		throw error;
	}

	const soakStarted = performance.now();
	let fixtureCount = 0;

	for (const entry of entries) {
		fixtureCount += 1;
		const started = performance.now();
		let firstHash: string | null = null;
		const tempPaths: string[] = [];

		try {
			for (let i = 1; i <= args.iterations; i++) {
				const outputPath = resolve(
					PACKAGE_ROOT,
					".tmp",
					`${entry.id}-soak-${i}.pdf`,
				);
				tempPaths.push(outputPath);

				const { sha256 } = renderFixtureFromManifest(entry, {
					outputPath,
				});

				const drift = detectSoakHashDrift(entry.id, i, firstHash, sha256);
				if (drift) {
					console.error(formatSoakDriftReport(drift));
					return 1;
				}
				if (firstHash === null) {
					firstHash = sha256;
				}
			}

			const durationMs = Math.round(performance.now() - started);
			console.log(
				`SOAK PASS ${entry.id}: ${args.iterations} iterations, hash ${firstHash}, ${durationMs}ms`,
			);
		} finally {
			for (const path of tempPaths) {
				try {
					unlinkSync(path);
				} catch {
					// .tmp is gitignored; best-effort cleanup
				}
			}
		}
	}

	const totalDurationMs = Math.round(performance.now() - soakStarted);
	console.log(
		`SOAK SUMMARY: ${fixtureCount} fixture(s), ${args.iterations} iteration(s) each, ${totalDurationMs}ms total`,
	);

	return 0;
}

process.exit(main());
