import { z } from "zod";
import type { BusinessRuleFinding } from "../validation/finding";
import { ERROR_CODES } from "./codes";

export const ApiErrorDetailSchema = z
	.object({
		path: z.string().min(1),
		code: z.enum(ERROR_CODES),
		message: z.string().min(1),
		expected: z.string().optional(),
		received: z.string().optional(),
	})
	.strict();

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export function businessFindingToDetail(
	finding: BusinessRuleFinding,
): ApiErrorDetail {
	return {
		path: finding.path,
		code: finding.code,
		message: finding.message,
		...(finding.expected !== undefined ? { expected: finding.expected } : {}),
		...(finding.received !== undefined ? { received: finding.received } : {}),
	};
}
