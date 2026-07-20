import {
	type ApiErrorDetail,
	buildApiErrorEnvelope,
	type ErrorCode,
	getHttpStatusForErrorCode,
} from "@usetagih/schema";
import { REQUEST_ID_HEADER } from "../middleware/request-id.js";

type StatusSetter = {
	status?: number | string;
	headers?: Record<string, unknown>;
};
type StatusFn = (code: number, body: unknown) => unknown;

function attachRequestIdHeader(set: StatusSetter, requestId: string) {
	set.headers ??= {};
	set.headers[REQUEST_ID_HEADER] = requestId;
}

export function respondApiError(options: {
	set: StatusSetter;
	code: ErrorCode;
	message: string;
	requestId: string;
	details?: readonly ApiErrorDetail[];
}) {
	const status = getHttpStatusForErrorCode(options.code);
	options.set.status = status;
	attachRequestIdHeader(options.set, options.requestId);
	return buildApiErrorEnvelope({
		code: options.code,
		message: options.message,
		requestId: options.requestId,
		details: options.details,
	});
}

export function statusApiError(
	status: StatusFn,
	set: StatusSetter,
	options: {
		code: ErrorCode;
		message: string;
		requestId: string;
		details?: readonly ApiErrorDetail[];
	},
) {
	attachRequestIdHeader(set, options.requestId);
	const httpStatus = getHttpStatusForErrorCode(options.code);
	return status(
		httpStatus,
		buildApiErrorEnvelope({
			code: options.code,
			message: options.message,
			requestId: options.requestId,
			details: options.details,
		}),
	);
}

export function respondApiErrorFromContext(
	ctx: { requestId: string; set: StatusSetter },
	options: {
		code: ErrorCode;
		message: string;
		details?: readonly ApiErrorDetail[];
	},
) {
	return respondApiError({
		set: ctx.set,
		requestId: ctx.requestId,
		...options,
	});
}

export function statusApiErrorFromStore(
	status: StatusFn,
	set: StatusSetter,
	store: { requestId: string },
	options: {
		code: ErrorCode;
		message: string;
		details?: readonly ApiErrorDetail[];
	},
) {
	return statusApiError(status, set, {
		...options,
		requestId: store.requestId,
	});
}
