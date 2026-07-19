import { expect, test } from "bun:test";
import { DOCUMENT_TYPES } from "../document/document-type";
import { CURRENT_SCHEMA_VERSION } from "./constants";
import { getSchemaMetadata, SchemaMetadataSchema } from "./metadata";

test("getSchemaMetadata matches PRD contract shape", () => {
	const meta = getSchemaMetadata();
	const parsed = SchemaMetadataSchema.parse(meta);

	expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
	expect(parsed.supportedVersions).toEqual([CURRENT_SCHEMA_VERSION]);
	expect(parsed.documentTypes).toEqual([...DOCUMENT_TYPES]);
	expect(parsed.templates.invoice).toEqual(["modern", "classic"]);
	expect(parsed.templates.quotation).toEqual(["modern", "classic"]);
	expect(parsed.templates.receipt).toEqual(["modern", "classic"]);
});

test("SchemaMetadataSchema rejects unknown keys", () => {
	const meta = getSchemaMetadata();
	expect(() => SchemaMetadataSchema.parse({ ...meta, extra: true })).toThrow();
});
