import { z } from "zod";
import { CURRENT_SCHEMA_VERSION } from "../version/constants";
import { BrandingSchema } from "./branding";
import { LineItemSchema } from "./line-item";
import { MetadataSchema } from "./metadata";
import { MoneySchema } from "./money";
import { PartySchema } from "./party";
import {
	isoCurrencySchema,
	isoDateSchema,
	schemaVersionSchema,
	templateSchema,
} from "./primitives";
import { TaxLineSchema } from "./tax-line";
import { TotalsSchema } from "./totals";

export const baseDocumentPayloadShape = {
	schemaVersion: schemaVersionSchema.default(CURRENT_SCHEMA_VERSION),
	template: templateSchema,
	documentNumber: z.string().max(64),
	issuedAt: isoDateSchema,
	currency: isoCurrencySchema,
	seller: PartySchema,
	lineItems: z.array(LineItemSchema).min(1).max(500),
	taxLines: z.array(TaxLineSchema).max(10).optional(),
	discount: MoneySchema.optional(),
	pricesIncludeTax: z.boolean().optional(),
	totals: TotalsSchema,
	notes: z.string().max(2000).optional(),
	metadata: MetadataSchema.optional(),
	branding: BrandingSchema.optional(),
	shareTtlDays: z.number().int().min(1).max(365).optional(),
} as const;

export const BaseDocumentPayloadSchema = z
	.object(baseDocumentPayloadShape)
	.strict();

export type BaseDocumentPayload = z.infer<typeof BaseDocumentPayloadSchema>;
