import type { BusinessRuleFinding } from "../validation/finding";
import { z } from "../zod.js";
import { ERROR_CODES, VALIDATION_FAILED_CODE } from "./codes";

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

export function zodPathToJsonPointer(path: PropertyKey[]): string {
	if (path.length === 0) {
		return "";
	}

	return path
		.map((segment) =>
			typeof segment === "number" ? `/${segment}` : `/${String(segment)}`,
		)
		.join("");
}

export function zodIssueToDetail(issue: z.core.$ZodIssue): ApiErrorDetail {
	let path = zodPathToJsonPointer(issue.path);

	if (issue.code === "unrecognized_keys" && issue.keys) {
		const [unrecognizedKey] = issue.keys;
		if (typeof unrecognizedKey === "string") {
			path = path ? `${path}/${unrecognizedKey}` : `/${unrecognizedKey}`;
		}
	}

	return {
		path,
		code: VALIDATION_FAILED_CODE,
		message: issue.message,
	};
}

export function zodIssuesToDetails(error: z.ZodError): ApiErrorDetail[] {
	return error.issues.map(zodIssueToDetail);
}
