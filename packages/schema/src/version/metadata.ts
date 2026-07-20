import { DOCUMENT_TYPES, DocumentTypeSchema } from "../document/document-type";
import type { Template } from "../document/primitives";
import { schemaVersionSchema, templateSchema } from "../document/primitives";
import { z } from "../zod.js";
import type { SchemaVersion } from "./constants";
import {
	CURRENT_SCHEMA_VERSION,
	SUPPORTED_SCHEMA_VERSIONS,
	TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE,
} from "./constants";

export type { Template };

export type SchemaMetadata = {
	schemaVersion: SchemaVersion;
	supportedVersions: readonly SchemaVersion[];
	documentTypes: typeof DOCUMENT_TYPES;
	templates: Record<(typeof DOCUMENT_TYPES)[number], readonly Template[]>;
};

export const SchemaMetadataSchema = z
	.object({
		schemaVersion: schemaVersionSchema,
		supportedVersions: z.array(schemaVersionSchema).min(1),
		documentTypes: z.array(DocumentTypeSchema).min(1),
		templates: z
			.object({
				invoice: z.array(templateSchema).min(1),
				quotation: z.array(templateSchema).min(1),
				receipt: z.array(templateSchema).min(1),
			})
			.strict(),
	})
	.strict();

export function getSchemaMetadata(): SchemaMetadata {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		supportedVersions: SUPPORTED_SCHEMA_VERSIONS,
		documentTypes: DOCUMENT_TYPES,
		templates: TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE,
	};
}
