import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ALLOWLIST = new Set(["packages/config/src/env/schema.ts"]);
const SCAN_ROOTS = ["packages", "apps"];

function collectTsFiles(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		if (entry === "node_modules" || entry === "dist") {
			continue;
		}

		const absolutePath = join(dir, entry);
		const stats = statSync(absolutePath);
		if (stats.isDirectory()) {
			files.push(...collectTsFiles(absolutePath));
			continue;
		}

		if (entry.endsWith(".ts")) {
			files.push(absolutePath);
		}
	}

	return files;
}

test("no duplicate zod definitions outside packages/schema", () => {
	const repoRoot = join(import.meta.dir, "../../../..");
	const violations: string[] = [];

	for (const scanRoot of SCAN_ROOTS) {
		const rootPath = join(repoRoot, scanRoot);
		for (const file of collectTsFiles(rootPath)) {
			const rel = relative(repoRoot, file);
			if (rel.startsWith("packages/schema/")) {
				continue;
			}
			if (ALLOWLIST.has(rel)) {
				continue;
			}

			const src = readFileSync(file, "utf8");
			if (/from\s+["']zod["']/.test(src) || /\bz\.object\s*\(/.test(src)) {
				violations.push(rel);
			}
		}
	}

	expect(violations).toEqual([]);
});
