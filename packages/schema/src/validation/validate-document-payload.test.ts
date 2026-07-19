import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UNSUPPORTED_SCHEMA_VERSION_CODE } from "../errors/codes";
import { validateDocumentPayload } from "./validate-document-payload";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "../..");

function loadJson(relativePath: string): Record<string, unknown> {
	const absolutePath = join(packageRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8")) as Record<
		string,
		unknown
	>;
}

test("validateDocumentPayload routes unsupported schemaVersion to schemaVersion stage", () => {
	const result = validateDocumentPayload({
		schemaVersion: "2099-01-01",
		documentType: "invoice",
	});
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}

	expect(result.stage).toBe("schemaVersion");
	if (result.stage === "schemaVersion") {
		expect(result.rejection.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	}
});

test("validateDocumentPayload passes valid fixture through all stages", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	const result = validateDocumentPayload(raw);
	expect(result.ok).toBe(true);
});

test("validateDocumentPayload defaults omitted schemaVersion before structural parse", () => {
	const raw = loadJson("__fixtures__/valid/invoice-minimal.json");
	delete raw.schemaVersion;

	const result = validateDocumentPayload(raw);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.data.schemaVersion).toBe("2026-07-20");
	}
});

test("validateDocumentPayload fails at schemaVersion stage before business rules", () => {
	const raw = loadJson(
		"__fixtures__/invalid/arithmetic/subtotal-mismatch.json",
	);
	raw.schemaVersion = "2099-01-01";

	const result = validateDocumentPayload(raw);
	expect(result.ok).toBe(false);
	if (result.ok) {
		return;
	}

	expect(result.stage).toBe("schemaVersion");
	if (result.stage === "schemaVersion") {
		expect(result.rejection.code).toBe(UNSUPPORTED_SCHEMA_VERSION_CODE);
	}
});
