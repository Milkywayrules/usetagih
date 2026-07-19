import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentPayloadSchema } from "./document-payload";
import { DocumentTypeSchema } from "./document-type";
import {
	checkDocumentTypeMismatch,
	DOCUMENT_TYPE_MISMATCH_CODE,
} from "./document-type-mismatch";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "../..");
const repoRoot = join(packageRoot, "../..");

function loadJson(relativePath: string): unknown {
	const absolutePath = join(packageRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function loadRepoJson(relativePath: string): unknown {
	const absolutePath = join(repoRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

test("parses valid minimal fixtures for all document types", () => {
	const fixtures = [
		{
			path: "__fixtures__/valid/invoice-minimal.json",
			documentType: "invoice",
		},
		{
			path: "__fixtures__/valid/quotation-minimal.json",
			documentType: "quotation",
		},
		{
			path: "__fixtures__/valid/receipt-minimal.json",
			documentType: "receipt",
		},
	] as const;

	for (const fixture of fixtures) {
		const payload = DocumentPayloadSchema.parse(loadJson(fixture.path));
		expect(payload.documentType).toBe(fixture.documentType);
	}
});

test("parses render invoice-modern-basic fixture", () => {
	const payload = DocumentPayloadSchema.parse(
		loadRepoJson(
			"packages/render/__fixtures__/payloads/invoice-modern-basic.json",
		),
	);
	expect(payload.documentType).toBe("invoice");
});

test("rejects branding.logoBytes under strict parse", () => {
	expect(() =>
		DocumentPayloadSchema.parse(
			loadJson("__fixtures__/invalid/structural/invoice-with-logo-bytes.json"),
		),
	).toThrow();
});

test("rejects cross-type fields on wrong document variants", () => {
	expect(() =>
		DocumentPayloadSchema.parse(
			loadJson("__fixtures__/invalid/structural/receipt-with-due-at.json"),
		),
	).toThrow();

	expect(() =>
		DocumentPayloadSchema.parse(
			loadJson("__fixtures__/invalid/structural/invoice-with-paid-at.json"),
		),
	).toThrow();
});

test("checkDocumentTypeMismatch handles match, omit, and mismatch", () => {
	expect(
		checkDocumentTypeMismatch("invoice", { documentType: "invoice" }),
	).toEqual({ match: true });

	expect(checkDocumentTypeMismatch("invoice", {})).toEqual({ match: true });

	const mismatch = checkDocumentTypeMismatch("invoice", {
		documentType: "receipt",
	});
	expect(mismatch).toEqual({
		match: false,
		code: DOCUMENT_TYPE_MISMATCH_CODE,
		message: "documentType in body (receipt) does not match path (invoice)",
		pathDocumentType: "invoice",
		bodyDocumentType: "receipt",
	});
});

test("DocumentTypeSchema rejects invalid discriminants", () => {
	expect(() => DocumentTypeSchema.parse("estimate")).toThrow();
});
