import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { compileTypst } from "../src/typst-driver";

const PACKAGE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const TEMPLATE_PATH = join(REPO_ROOT, "packages/templates/invoice/modern.typ");

function sha256File(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

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

const { fixture, tier, out } = parseArgs(process.argv.slice(2));

const payloadPath = resolve(
	PACKAGE_ROOT,
	`__fixtures__/payloads/${fixture}.json`,
);
const payloadInput = relative(
	join(REPO_ROOT, "packages/templates/invoice"),
	payloadPath,
);

mkdirSync(dirname(out), { recursive: true });

compileTypst({
	inputPath: TEMPLATE_PATH,
	outputPath: out,
	extraArgs: ["--input", `json=${payloadInput}`, "--input", `tier=${tier}`],
});

const hash = sha256File(out);

console.log(`Rendered ${fixture} (tier=${tier})`);
console.log(`Output: ${out}`);
console.log(`SHA-256: ${hash}`);
