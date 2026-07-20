import { z } from "../zod.js";
import { MoneySchema } from "./money";
import { taxRateSchema } from "./primitives";

export const TaxLineSchema = z
	.object({
		name: z.string().max(100),
		rate: taxRateSchema,
		amount: MoneySchema,
	})
	.strict();

export type TaxLine = z.infer<typeof TaxLineSchema>;
