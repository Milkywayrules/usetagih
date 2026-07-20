import {
	type ApiErrorDetail,
	INTERNAL_ERROR_CODE,
	NOT_FOUND_CODE,
	VALIDATION_FAILED_CODE,
	zodIssuesToDetails,
	zodPathToJsonPointer,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../lib/api-error.js";

type ElysiaValidationIssue = {
	path?: string;
	message?: string;
};

type ElysiaValidationError = {
	valueError?: {
		path: PropertyKey[];
		message: string;
		code: string;
	};
	all?: ElysiaValidationIssue[];
	cause?: unknown;
};

type ZodLikeError = {
	name: string;
	issues: unknown[];
};

function isZodLikeError(error: unknown): error is ZodLikeError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		(error as { name: string }).name === "ZodError" &&
		"issues" in error &&
		Array.isArray((error as { issues: unknown }).issues)
	);
}

function pointerFromElysiaPath(path: string | undefined): string {
	if (!path || path === "root") {
		return "";
	}
	return `/${path.split(".").join("/")}`;
}

function validationDetails(error: unknown): readonly ApiErrorDetail[] {
	if (isZodLikeError(error)) {
		return zodIssuesToDetails(
			error as Parameters<typeof zodIssuesToDetails>[0],
		);
	}

	if (error && typeof error === "object") {
		const validationError = error as ElysiaValidationError;

		if (validationError.valueError) {
			return [
				{
					path: zodPathToJsonPointer(validationError.valueError.path),
					code: VALIDATION_FAILED_CODE,
					message: validationError.valueError.message,
				},
			];
		}

		if (isZodLikeError(validationError.cause)) {
			return zodIssuesToDetails(
				validationError.cause as Parameters<typeof zodIssuesToDetails>[0],
			);
		}

		if (Array.isArray(validationError.all) && validationError.all.length > 0) {
			return validationError.all.map((issue) => ({
				path: pointerFromElysiaPath(issue.path),
				code: VALIDATION_FAILED_CODE,
				message: issue.message ?? "Validation failed",
			}));
		}
	}

	return [];
}

export function createV1ErrorHandler() {
	return new Elysia({ name: "v1-error-handler" })
		.onError({ as: "global" }, ({ code, error, set, store }) => {
			const requestId = (store as { requestId: string }).requestId;

			if (code === "NOT_FOUND") {
				return respondApiError({
					set,
					code: NOT_FOUND_CODE,
					message: "Route not found",
					requestId,
				});
			}

			if (code === "VALIDATION" || code === "PARSE") {
				return respondApiError({
					set,
					code: VALIDATION_FAILED_CODE,
					message: "Request validation failed",
					requestId,
					details: validationDetails(error),
				});
			}

			console.error(error);
			return respondApiError({
				set,
				code: INTERNAL_ERROR_CODE,
				message: "An internal error occurred",
				requestId,
			});
		})
		.all("*", ({ set, store }) =>
			respondApiError({
				set,
				code: NOT_FOUND_CODE,
				message: "Route not found",
				requestId: (store as { requestId: string }).requestId,
			}),
		);
}
