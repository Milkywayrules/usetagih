import { resolve } from "node:path";
import { loadManifest } from "../src/golden";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "../src/golden/render-fixture";

const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

function main(): number {
	const manifest = loadManifest(MANIFEST_PATH);
	let exitCode = 0;

	for (const entry of manifest.fixtures) {
		try {
			const { outputPath, sha256 } = renderFixtureFromManifest(entry);
			console.log(`${entry.id} → ${outputPath} (${sha256})`);
		} catch (error) {
			console.error(
				`FAIL ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
			);
			exitCode = 1;
		}
	}

	return exitCode;
}

process.exit(main());
