import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_SPECIFIERS = [
	"@usetagih/db",
	"@usetagih/render",
	"drizzle-orm",
	"postgres",
	"better-auth",
	"@aws-sdk/",
	"@smithy/",
	"elysia",
] as const;

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function forbiddenImportPatterns(specifier: string): RegExp[] {
	const escaped = escapeRegExp(specifier);
	const modulePattern =
		specifier.endsWith("/") || specifier.includes("/")
			? escaped
			: `(?:${escaped}|${escaped}/[^"']+)`;

	return [
		new RegExp(`from\\s+["']${modulePattern}["']`),
		new RegExp(`import\\s*\\(\\s*["']${modulePattern}["']`),
		new RegExp(`require\\s*\\(\\s*["']${modulePattern}["']`),
		new RegExp(`import\\s+type\\s+[^;\\n]*from\\s+["']${modulePattern}["']`),
	];
}

const FORBIDDEN_IMPORT_PATTERNS = FORBIDDEN_SPECIFIERS.flatMap(
	forbiddenImportPatterns,
);

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

test("runtime dependencies are schema-only", () => {
	const pkg = JSON.parse(
		readFileSync(join(packageRoot, "package.json"), "utf8"),
	) as { dependencies?: Record<string, string> };
	expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@usetagih/schema"]);
});

test("src has no forbidden adapter or driver imports", () => {
	const srcRoot = join(packageRoot, "src");
	const violations: string[] = [];

	for (const file of collectTsFiles(srcRoot)) {
		const rel = relative(packageRoot, file);
		if (rel.endsWith(".test.ts")) {
			continue;
		}
		const src = readFileSync(file, "utf8");

		for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
			if (pattern.test(src)) {
				violations.push(`${rel} matches ${pattern}`);
			}
		}
	}

	expect(violations).toEqual([]);
});
