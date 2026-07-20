import { z } from "../zod.js";
import { MoneySchema } from "./money";

export const TotalsSchema = z
	.object({
		subtotal: MoneySchema,
		taxTotal: MoneySchema,
		grandTotal: MoneySchema,
	})
	.strict();

export type Totals = z.infer<typeof TotalsSchema>;
