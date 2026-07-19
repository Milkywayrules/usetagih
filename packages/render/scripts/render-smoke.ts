import { createHash } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileTypst } from "../src/typst-driver";

const PACKAGE_ROOT = resolve(import.meta.dir, "..");
const FIXTURE = join(PACKAGE_ROOT, "__fixtures__/smoke/hello.typ");
const OUT_1 = join(PACKAGE_ROOT, ".tmp-smoke-1.pdf");
const OUT_2 = join(PACKAGE_ROOT, ".tmp-smoke-2.pdf");

function sha256(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

try {
	compileTypst({ inputPath: FIXTURE, outputPath: OUT_1 });
	compileTypst({ inputPath: FIXTURE, outputPath: OUT_2 });

	const hash1 = sha256(OUT_1);
	const hash2 = sha256(OUT_2);

	console.log(`Smoke PDF 1 SHA-256: ${hash1}`);
	console.log(`Smoke PDF 2 SHA-256: ${hash2}`);

	if (hash1 !== hash2) {
		console.error("FAIL: consecutive compiles produced different PDF hashes");
		process.exit(1);
	}

	console.log("PASS: byte-identical PDF output across consecutive compiles");
} finally {
	for (const file of [OUT_1, OUT_2]) {
		try {
			unlinkSync(file);
		} catch {
			// ignore cleanup errors
		}
	}
}
