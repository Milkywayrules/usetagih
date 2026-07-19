import { z } from "zod";
import { MoneySchema } from "./money";
import { quantitySchema, taxRateSchema } from "./primitives";

export const LineItemSchema = z
	.object({
		description: z.string().max(500),
		quantity: quantitySchema,
		unit: z.string().max(50).optional(),
		unitPrice: MoneySchema,
		taxRate: taxRateSchema.optional(),
		lineTotal: MoneySchema,
	})
	.strict();

export type LineItem = z.infer<typeof LineItemSchema>;
