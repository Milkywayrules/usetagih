import {
	type ApiErrorDetail,
	buildApiErrorEnvelope,
	type ErrorCode,
	getHttpStatusForErrorCode,
} from "@usetagih/schema";
import { REQUEST_ID_HEADER } from "../middleware/request-id.js";
import { applySecurityHeadersToSet } from "../middleware/security-headers.js";

type StatusSetter = {
	status?: number | string;
	headers?: Record<string, unknown>;
};
type StatusFn = (code: number, body: unknown) => unknown;

function attachStandardResponseHeaders(
	set: StatusSetter,
	requestId: string,
	path: string,
) {
	set.headers ??= {};
	set.headers[REQUEST_ID_HEADER] = requestId;
	applySecurityHeadersToSet(set, path);
}

function resolveRequestPath(request?: Request, path?: string) {
	if (path) {
		return path;
	}
	if (request) {
		return new URL(request.url).pathname;
	}
	return "";
}

export function respondApiError(options: {
	set: StatusSetter;
	code: ErrorCode;
	message: string;
	requestId: string;
	request?: Request;
	path?: string;
	details?: readonly ApiErrorDetail[];
}) {
	const status = getHttpStatusForErrorCode(options.code);
	options.set.status = status;
	attachStandardResponseHeaders(
		options.set,
		options.requestId,
		resolveRequestPath(options.request, options.path),
	);
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
		request?: Request;
		path?: string;
		details?: readonly ApiErrorDetail[];
	},
) {
	attachStandardResponseHeaders(
		set,
		options.requestId,
		resolveRequestPath(options.request, options.path),
	);
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
	ctx: { requestId: string; set: StatusSetter; request?: Request },
	options: {
		code: ErrorCode;
		message: string;
		details?: readonly ApiErrorDetail[];
	},
) {
	return respondApiError({
		set: ctx.set,
		requestId: ctx.requestId,
		request: ctx.request,
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
		request?: Request;
		details?: readonly ApiErrorDetail[];
	},
) {
	return statusApiError(status, set, {
		...options,
		requestId: store.requestId,
	});
}
