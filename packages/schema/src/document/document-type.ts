import type { z } from "../zod.js";
import { documentTypeSchema } from "./primitives";

export const DocumentTypeSchema = documentTypeSchema;

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DOCUMENT_TYPES = DocumentTypeSchema.options;
