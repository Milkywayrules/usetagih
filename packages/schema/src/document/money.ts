import { z } from "../zod.js";
import { moneyAmountSchema } from "./primitives";

export const MoneySchema = z
	.object({
		amount: moneyAmountSchema,
	})
	.strict();

export type Money = z.infer<typeof MoneySchema>;
