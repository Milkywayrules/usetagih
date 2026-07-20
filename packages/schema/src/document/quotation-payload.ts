import { z } from "../zod.js";
import { baseDocumentPayloadShape } from "./base-document-payload";
import { PartySchema } from "./party";
import { isoDateSchema } from "./primitives";

export const QuotationPayloadSchema = z
	.object({
		...baseDocumentPayloadShape,
		documentType: z.literal("quotation"),
		validUntil: isoDateSchema.optional(),
		buyer: PartySchema,
	})
	.strict();

export type QuotationPayload = z.infer<typeof QuotationPayloadSchema>;
