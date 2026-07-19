import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentPayloadSchema } from "../document/document-payload";
import { UNSUPPORTED_SCHEMA_VERSION_CODE } from "../errors/codes";
import { getHttpStatusForErrorCode } from "../errors/http-status";
import {
	assertSupportedSchemaVersion,
	normalizePayloadSchemaVersion,
} from "./assert-schema-version";
import { CURRENT_SCHEMA_VERSION } from "./constants";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "../..");

function loadJson(relativePath: string): Record<string, unknown> {
	const absolutePath = join(packageRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8")) as Record<
		string,
		unknown
	>;
}

test("normalizePayloadSchemaVersion defaults omitted schemaVersion", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	delete raw.schemaVersion;

	const norm = normalizePayloadSchemaVersion(raw);
	expect(norm.ok).toBe(true);
	if (!norm.ok) {
		return;
	}

	expect(norm.normalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

	const parsed = DocumentPayloadSchema.parse(norm.normalized);
	expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
});

test("DocumentPayloadSchema defaults schemaVersion when field omitted", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	delete raw.schemaVersion;

	const parsed = DocumentPayloadSchema.parse(raw);
	expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
});

test("assertSupportedSchemaVersion accepts current version", () => {
	expect(assertSupportedSchemaVersion(CURRENT_SCHEMA_VERSION)).toEqual({
		ok: true,
		schemaVersion: CURRENT_SCHEMA_VERSION,
	});
});

test("assertSupportedSchemaVersion rejects unknown version with supported list", () => {
	const result = assertSupportedSchemaVersion("2025-01-01");
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}

	expect(result.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	expect(result.message).toContain("2025-01-01");
	expect(result.message).toContain("Supported versions: 2026-07-20");
	expect(result.supportedVersions).toEqual([CURRENT_SCHEMA_VERSION]);
	expect(getHttpStatusForErrorCode(result.code)).toBe(400);
});

test("assertSupportedSchemaVersion rejects non-string values", () => {
	const result = assertSupportedSchemaVersion(123);
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}

	expect(result.received).toBe("123");
	expect(result.message).toContain("Supported versions: 2026-07-20");
});

test("normalizePayloadSchemaVersion rejects unknown schemaVersion on object", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	raw.schemaVersion = "2099-01-01";

	const result = normalizePayloadSchemaVersion(raw);
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}

	expect(result.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	expect(result.message).toContain("2099-01-01");
});

test("normalizePayloadSchemaVersion passes through non-object raw unchanged", () => {
	for (const value of [null, "string", 42, []]) {
		const result = normalizePayloadSchemaVersion(value);
		expect(result.ok).toBe(true);
		if (!result.ok) {
			continue;
		}
		expect((result.normalized as unknown) === value).toBe(true);
	}
});

test("assertSupportedSchemaVersion rejects silent-acceptance edge cases", () => {
	const edgeCases: unknown[] = [
		null,
		"",
		"2026-7-20",
		20260720,
		"2099-12-31",
		" 2026-07-20",
		"2026-07-20 ",
		new String(CURRENT_SCHEMA_VERSION),
		{ toString: () => CURRENT_SCHEMA_VERSION },
	];

	for (const value of edgeCases) {
		const result = assertSupportedSchemaVersion(value);
		expect(result.ok).toBe(false);
		if (result.ok) {
			continue;
		}
		expect(result.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	}
});

test("normalizePayloadSchemaVersion rejects null schemaVersion key", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	raw.schemaVersion = null;

	const result = normalizePayloadSchemaVersion(raw);
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}
	expect(result.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	expect(result.received).toBe("null");
});

test("normalize then parse matches direct DocumentPayloadSchema.parse for omitted schemaVersion", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	delete raw.schemaVersion;

	const norm = normalizePayloadSchemaVersion(raw);
	expect(norm.ok).toBe(true);
	if (!norm.ok) {
		return;
	}

	const viaNormalize = DocumentPayloadSchema.parse(norm.normalized);
	const viaDirect = DocumentPayloadSchema.parse(raw);
	expect(viaNormalize).toEqual(viaDirect);
});
