import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadManifest } from "../src/golden";
import {
	PACKAGE_ROOT,
	renderFixtureFromManifest,
} from "../src/golden/render-fixture";

const MANIFEST_PATH = resolve(PACKAGE_ROOT, "manifest.json");

function parseArgs(argv: string[]): {
	fixture: string;
	tier: string;
	out: string;
} {
	let fixture = "";
	let tier = "free";
	let out = "";

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--fixture" && argv[i + 1]) {
			fixture = argv[++i] ?? "";
		} else if (arg === "--tier" && argv[i + 1]) {
			tier = argv[++i] ?? "free";
		} else if (arg === "--out" && argv[i + 1]) {
			out = argv[++i] ?? "";
		} else if (arg === "--help" || arg === "-h") {
			console.log(
				"Usage: bun scripts/render-fixture.ts --fixture <name> [--tier free|pro] [--out <pdf-path>]",
			);
			process.exit(0);
		}
	}

	if (!fixture) {
		console.error(
			"Usage: bun scripts/render-fixture.ts --fixture <name> [--tier free|pro] [--out <pdf-path>]",
		);
		process.exit(1);
	}

	const outputPath = out || join(PACKAGE_ROOT, ".tmp", `${fixture}.pdf`);

	return { fixture, tier, out: outputPath };
}

function findManifestEntry(fixture: string, tier: string) {
	const manifest = loadManifest(MANIFEST_PATH);
	const byId = manifest.fixtures.find((entry) => entry.id === fixture);
	if (byId) {
		return {
			...byId,
			inputs: { ...byId.inputs, tier },
		};
	}

	if (fixture === "invoice-modern-basic") {
		return {
			id: fixture,
			payload: `__fixtures__/payloads/${fixture}.json`,
			template: "../templates/invoice/modern.typ",
			sha256: "",
			typstVersion: manifest.typstVersion,
			schemaVersion: "2026-07-20",
			inputs: { tier },
		};
	}

	console.error(`Fixture not found in manifest: ${fixture}`);
	process.exit(1);
}

const { fixture, tier, out } = parseArgs(process.argv.slice(2));
const entry = findManifestEntry(fixture, tier);

mkdirSync(dirname(out), { recursive: true });

const { sha256 } = renderFixtureFromManifest(entry, { outputPath: out });

console.log(`Rendered ${fixture} (tier=${tier})`);
console.log(`Output: ${out}`);
console.log(`SHA-256: ${sha256}`);
