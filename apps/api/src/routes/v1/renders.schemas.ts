import { z } from "zod";

export const RenderIdParamSchema = z.object({
	renderId: z.string().min(1),
});

export const ListRendersQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
	documentType: z.enum(["invoice", "quotation", "receipt"]).optional(),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});
