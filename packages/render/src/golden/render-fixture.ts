import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareLogoForTypst } from "../logo-prep";
import { compileTypst } from "../typst-driver";
import type { GoldenFixtureEntry } from "./manifest";

export const PACKAGE_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

export type RenderFixtureResult = {
	outputPath: string;
	sha256: string;
	pdfBytes: Buffer;
};

export type RenderFixtureOptions = {
	outputPath?: string;
};

function sha256Buffer(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

export function resolveTemplatePath(entry: GoldenFixtureEntry): string {
	const templateAbs = resolve(PACKAGE_ROOT, entry.template);
	if (!existsSync(templateAbs)) {
		throw new Error(
			`template not found for fixture "${entry.id}": ${templateAbs} (manifest template: ${entry.template})`,
		);
	}
	return templateAbs;
}

export function buildTypstInputArgs(
	templatePath: string,
	payloadPath: string,
	inputs: Record<string, string>,
): string[] {
	const templateDir = dirname(templatePath);
	const payloadInput = relative(templateDir, payloadPath);

	const inputArgs = Object.entries(inputs).flatMap(([key, value]) => [
		"--input",
		`${key}=${value}`,
	]);

	const logoPrep = prepareLogoForTypst(payloadPath, templateDir);
	const logoArgs =
		logoPrep.logoInputArg !== undefined
			? ["--input", logoPrep.logoInputArg]
			: [];

	return ["--input", `json=${payloadInput}`, ...inputArgs, ...logoArgs];
}

export function renderFixtureFromManifest(
	entry: GoldenFixtureEntry,
	options: RenderFixtureOptions = {},
): RenderFixtureResult {
	const templateAbs = resolveTemplatePath(entry);
	const payloadAbs = resolve(PACKAGE_ROOT, entry.payload);

	const outputPath =
		options.outputPath ?? resolve(PACKAGE_ROOT, ".tmp", `${entry.id}.pdf`);

	mkdirSync(dirname(outputPath), { recursive: true });

	compileTypst({
		inputPath: templateAbs,
		outputPath,
		extraArgs: buildTypstInputArgs(templateAbs, payloadAbs, entry.inputs),
	});

	const pdfBytes = readFileSync(outputPath);
	const sha256 = sha256Buffer(pdfBytes);

	return { outputPath, sha256, pdfBytes };
}
