import { z } from "../zod.js";

export const BusinessIdentitySchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		email: z.string().email().max(320).optional(),
		address: z.string().min(1).max(2000).optional(),
		taxId: z.string().min(1).max(100).optional(),
	})
	.strict();

export type BusinessIdentity = z.infer<typeof BusinessIdentitySchema>;

export const UpdateBusinessIdentityBodySchema =
	BusinessIdentitySchema.partial();
