import { z } from "../zod.js";
import type { ErrorCode } from "./codes";
import { ERROR_CODES } from "./codes";
import { type ApiErrorDetail, ApiErrorDetailSchema } from "./detail";

export const ApiErrorEnvelopeSchema = z
	.object({
		error: z
			.object({
				code: z.enum(ERROR_CODES),
				message: z.string().min(1),
				requestId: z.string().min(1),
				details: z.array(ApiErrorDetailSchema),
			})
			.strict(),
	})
	.strict();

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export type BuildApiErrorEnvelopeInput = {
	code: ErrorCode;
	message: string;
	requestId: string;
	details?: readonly ApiErrorDetail[];
};

export function buildApiErrorEnvelope(
	input: BuildApiErrorEnvelopeInput,
): ApiErrorEnvelope {
	return {
		error: {
			code: input.code,
			message: input.message,
			requestId: input.requestId,
			details: input.details ? [...input.details] : [],
		},
	};
}
