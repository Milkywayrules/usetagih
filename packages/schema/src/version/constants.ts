import type { DocumentType } from "../document/document-type";

export const CURRENT_SCHEMA_VERSION = "2026-07-20" as const;

export const SUPPORTED_SCHEMA_VERSIONS = [CURRENT_SCHEMA_VERSION] as const;

export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export const TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE = {
	invoice: ["modern", "classic"],
	quotation: ["modern", "classic"],
	receipt: ["modern", "classic"],
} as const satisfies Record<DocumentType, readonly ["modern", "classic"]>;
