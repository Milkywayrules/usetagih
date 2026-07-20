import { ApiScopeArraySchema } from "@usetagih/schema";
import { z } from "zod";

export const CreateApiKeyBodySchema = z.object({
	name: z.string().trim().min(1).max(128),
	scopes: ApiScopeArraySchema,
	expiresAt: z.string().datetime().optional().nullable(),
});

export const ApiKeyIdParamSchema = z.object({
	keyId: z.string().min(1),
});
