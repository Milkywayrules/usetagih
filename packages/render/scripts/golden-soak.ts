import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "../src/golden";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "../src/golden/render-fixture";

const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

function parseArgs(argv: string[]): { iterations: number } {
	let iterations = 5;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--iterations" && argv[i + 1]) {
			iterations = Number.parseInt(argv[++i] ?? "5", 10);
		}
	}

	if (!Number.isFinite(iterations) || iterations < 1) {
		console.error("Usage: bun scripts/golden-soak.ts [--iterations N]");
		process.exit(1);
	}

	return { iterations };
}

function main(): number {
	const { iterations } = parseArgs(process.argv.slice(2));
	const manifest = loadManifest(MANIFEST_PATH);

	for (const entry of manifest.fixtures) {
		const started = performance.now();
		let firstHash: string | null = null;
		const tempPaths: string[] = [];

		try {
			for (let i = 1; i <= iterations; i++) {
				const outputPath = resolve(
					PACKAGE_ROOT,
					".tmp",
					`${entry.id}-soak-${i}.pdf`,
				);
				tempPaths.push(outputPath);

				const { sha256 } = renderFixtureFromManifest(entry, {
					outputPath,
				});

				if (firstHash === null) {
					firstHash = sha256;
				} else if (sha256 !== firstHash) {
					console.error(
						[
							`FAIL ${entry.id}`,
							`  drift at iteration ${i}`,
							`  first hash: ${firstHash}`,
							`  actual: ${sha256}`,
						].join("\n"),
					);
					return 1;
				}
			}

			const durationMs = Math.round(performance.now() - started);
			console.log(
				`SOAK PASS ${entry.id}: ${iterations} iterations, hash ${firstHash}, ${durationMs}ms`,
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

	return 0;
}

process.exit(main());
