import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

function resolveTemplatePath(entry: GoldenFixtureEntry): string {
	const templateAbs = resolve(PACKAGE_ROOT, entry.template);
	if (!existsSync(templateAbs)) {
		throw new Error(
			`template not found for fixture "${entry.id}": ${templateAbs} (manifest template: ${entry.template})`,
		);
	}
	return templateAbs;
}

export function renderFixtureFromManifest(
	entry: GoldenFixtureEntry,
	options: RenderFixtureOptions = {},
): RenderFixtureResult {
	const templateAbs = resolveTemplatePath(entry);
	const templateDir = dirname(templateAbs);
	const payloadAbs = resolve(PACKAGE_ROOT, entry.payload);
	const payloadInput = relative(templateDir, payloadAbs);

	const outputPath =
		options.outputPath ?? resolve(PACKAGE_ROOT, ".tmp", `${entry.id}.pdf`);

	mkdirSync(dirname(outputPath), { recursive: true });

	const inputArgs = Object.entries(entry.inputs).flatMap(([key, value]) => [
		"--input",
		`${key}=${value}`,
	]);

	compileTypst({
		inputPath: templateAbs,
		outputPath,
		extraArgs: ["--input", `json=${payloadInput}`, ...inputArgs],
	});

	const pdfBytes = readFileSync(outputPath);
	const sha256 = sha256Buffer(pdfBytes);

	return { outputPath, sha256, pdfBytes };
}
