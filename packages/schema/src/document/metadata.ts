import { z } from "zod";

export const MetadataSchema = z
	.record(z.string().max(64), z.string().max(256))
	.refine((record) => Object.keys(record).length <= 20);

export type Metadata = z.infer<typeof MetadataSchema>;
