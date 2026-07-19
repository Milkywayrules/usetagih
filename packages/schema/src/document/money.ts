import { z } from "zod";
import { moneyAmountSchema } from "./primitives";

export const MoneySchema = z
	.object({
		amount: moneyAmountSchema,
	})
	.strict();

export type Money = z.infer<typeof MoneySchema>;
