import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class ManifestParseError extends Error {
	constructor(
		message: string,
		public readonly path: string,
	) {
		super(`${path}: ${message}`);
		this.name = "ManifestParseError";
	}
}

export type GoldenFixtureEntry = {
	id: string;
	payload: string;
	template: string;
	sha256: string;
	typstVersion: string;
	schemaVersion: string;
	inputs: Record<string, string>;
};

export type GoldenManifest = {
	typstVersion: string;
	schemaVersion: string;
	fixtures: GoldenFixtureEntry[];
};

function requireString(value: unknown, path: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new ManifestParseError("expected non-empty string", path);
	}
	return value;
}

function requireSha256(value: unknown, path: string): string {
	const str = requireString(value, path);
	if (!SHA256_PATTERN.test(str)) {
		throw new ManifestParseError("expected 64-char lowercase hex", path);
	}
	return str;
}

function requireInputs(value: unknown, path: string): Record<string, string> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new ManifestParseError("expected object", path);
	}

	const inputs: Record<string, string> = {};
	for (const [key, entryValue] of Object.entries(value)) {
		if (typeof entryValue !== "string") {
			throw new ManifestParseError(
				`inputs.${key}: expected string value`,
				path,
			);
		}
		inputs[key] = entryValue;
	}
	return inputs;
}

export function parseFixtureEntry(
	value: unknown,
	index: number,
): GoldenFixtureEntry {
	const basePath = `fixtures[${index}]`;

	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new ManifestParseError("expected object", basePath);
	}

	const record = value as Record<string, unknown>;

	return {
		id: requireString(record.id, `${basePath}.id`),
		payload: requireString(record.payload, `${basePath}.payload`),
		template: requireString(record.template, `${basePath}.template`),
		sha256: requireSha256(record.sha256, `${basePath}.sha256`),
		typstVersion: requireString(
			record.typstVersion,
			`${basePath}.typstVersion`,
		),
		schemaVersion: requireString(
			record.schemaVersion,
			`${basePath}.schemaVersion`,
		),
		inputs: requireInputs(record.inputs, `${basePath}.inputs`),
	};
}

export function loadManifest(manifestPath: string): GoldenManifest {
	const absPath = resolve(manifestPath);
	const raw = JSON.parse(readFileSync(absPath, "utf8")) as Record<
		string,
		unknown
	>;

	const typstVersion = requireString(raw.typstVersion, "typstVersion");
	const schemaVersion = requireString(raw.schemaVersion, "schemaVersion");

	if (!Array.isArray(raw.fixtures)) {
		throw new ManifestParseError("expected array", "fixtures");
	}

	const fixtures = raw.fixtures.map((entry, index) =>
		parseFixtureEntry(entry, index),
	);

	return { typstVersion, schemaVersion, fixtures };
}

export function goldenHashFilePath(
	packageRoot: string,
	fixtureId: string,
): string {
	return resolve(packageRoot, "__fixtures__/golden", `${fixtureId}.sha256`);
}

export function readGoldenHashFile(path: string): string {
	const content = readFileSync(path, "utf8").trim();
	if (!SHA256_PATTERN.test(content)) {
		throw new ManifestParseError("expected 64-char lowercase hex", path);
	}
	return content;
}
