import { z } from "zod";
import { baseDocumentPayloadShape } from "./base-document-payload";
import { PartySchema } from "./party";
import { isoDateSchema } from "./primitives";

export const InvoicePayloadSchema = z
	.object({
		...baseDocumentPayloadShape,
		documentType: z.literal("invoice"),
		dueAt: isoDateSchema.optional(),
		buyer: PartySchema,
	})
	.strict();

export type InvoicePayload = z.infer<typeof InvoicePayloadSchema>;
