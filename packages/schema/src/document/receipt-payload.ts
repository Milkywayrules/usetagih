import { z } from "../zod.js";
import { baseDocumentPayloadShape } from "./base-document-payload";
import { PartySchema } from "./party";
import { isoDateSchema } from "./primitives";

export const ReceiptPayloadSchema = z
	.object({
		...baseDocumentPayloadShape,
		documentType: z.literal("receipt"),
		paidAt: isoDateSchema.optional(),
		paymentReference: z.string().max(128).optional(),
		buyer: PartySchema.optional(),
	})
	.strict();

export type ReceiptPayload = z.infer<typeof ReceiptPayloadSchema>;
