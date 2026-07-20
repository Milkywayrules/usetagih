import { z } from "../zod.js";
import { cssHexColorSchema, httpsUrlSchema } from "./primitives";

export const BrandingSchema = z
	.object({
		logoUrl: httpsUrlSchema.optional(),
		accentColor: cssHexColorSchema.optional(),
	})
	.strict();

export type Branding = z.infer<typeof BrandingSchema>;
