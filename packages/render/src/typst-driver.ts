import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SOURCE_DATE_EPOCH = 1700000000;

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");

export type CompileTypstOptions = {
	inputPath: string;
	outputPath: string;
	format?: "pdf" | "svg";
	fontPath?: string;
	extraArgs?: string[];
};

export type EvalTypstOptions = {
	inputPath: string;
	expression: string;
	fontPath?: string;
	extraArgs?: string[];
};

function buildTypstEnv(): NodeJS.ProcessEnv {
	return {
		...process.env,
		SOURCE_DATE_EPOCH:
			process.env.SOURCE_DATE_EPOCH ?? String(DEFAULT_SOURCE_DATE_EPOCH),
	};
}

function buildTypstInputArgs(extraArgs: string[] = []): string[] {
	return extraArgs;
}

export function resolveTypstBinaryPath(): string {
	const envPath = process.env.TYPST_BINARY_PATH;
	if (envPath) {
		return resolve(envPath);
	}

	const localBin = join(PACKAGE_ROOT, ".bin", "typst");
	if (existsSync(localBin)) {
		return localBin;
	}

	return "/usr/local/bin/typst";
}

export function resolveFontPath(): string {
	return join(PACKAGE_ROOT, "fonts");
}

export function compileTypst(options: CompileTypstOptions): void {
	const {
		inputPath,
		outputPath,
		format = "pdf",
		fontPath = resolveFontPath(),
		extraArgs = [],
	} = options;

	const binaryPath = resolveTypstBinaryPath();
	const env = buildTypstEnv();

	const args = [
		"compile",
		"--root",
		REPO_ROOT,
		"--ignore-system-fonts",
		"--font-path",
		fontPath,
		...(format === "svg" ? ["--format", "svg"] : []),
		resolve(inputPath),
		resolve(outputPath),
		...buildTypstInputArgs(extraArgs),
	];

	const result = Bun.spawnSync([binaryPath, ...args], {
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(
			`Typst compile failed (exit ${result.exitCode}): ${stderr || "no stderr"}`,
		);
	}
}

export function evalTypst(options: EvalTypstOptions): string {
	const {
		inputPath,
		expression,
		fontPath = resolveFontPath(),
		extraArgs = [],
	} = options;

	const binaryPath = resolveTypstBinaryPath();
	const env = buildTypstEnv();

	const args = [
		"eval",
		expression,
		"--root",
		REPO_ROOT,
		"--ignore-system-fonts",
		"--font-path",
		fontPath,
		"--in",
		resolve(inputPath),
		...buildTypstInputArgs(extraArgs),
	];

	const result = Bun.spawnSync([binaryPath, ...args], {
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(
			`Typst eval failed (exit ${result.exitCode}): ${stderr || "no stderr"}`,
		);
	}

	return result.stdout.toString().trim();
}
