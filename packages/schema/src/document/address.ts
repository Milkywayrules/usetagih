import { z } from "../zod.js";
import { isoCountrySchema } from "./primitives";

export const AddressSchema = z
	.object({
		line1: z.string().max(200),
		line2: z.string().max(200).optional(),
		city: z.string().max(100),
		region: z.string().max(100).optional(),
		postalCode: z.string().max(20).optional(),
		country: isoCountrySchema,
	})
	.strict();

export type Address = z.infer<typeof AddressSchema>;
