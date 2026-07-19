import { z } from "zod";
import { InvoicePayloadSchema } from "./invoice-payload";
import { QuotationPayloadSchema } from "./quotation-payload";
import { ReceiptPayloadSchema } from "./receipt-payload";

export const DocumentPayloadSchema = z.discriminatedUnion("documentType", [
	InvoicePayloadSchema,
	QuotationPayloadSchema,
	ReceiptPayloadSchema,
]);

export type DocumentPayload = z.infer<typeof DocumentPayloadSchema>;
