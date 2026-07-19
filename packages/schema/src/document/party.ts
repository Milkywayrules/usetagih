import { z } from "zod";
import { AddressSchema } from "./address";

export const PartySchema = z
	.object({
		name: z.string().max(200),
		email: z.string().max(254).optional(),
		address: AddressSchema.optional(),
		taxId: z.string().max(50).optional(),
	})
	.strict();

export type Party = z.infer<typeof PartySchema>;
