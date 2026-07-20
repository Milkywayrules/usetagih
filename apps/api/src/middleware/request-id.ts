import { Elysia } from "elysia";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const REQUEST_ID_PATTERN =
	/^req_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requestIds = new WeakMap<Request, string>();

export function createRequestId() {
	return `req_${crypto.randomUUID()}`;
}

export function resolveRequestId(inbound: string | null): string {
	if (inbound && REQUEST_ID_PATTERN.test(inbound)) {
		return inbound;
	}
	return createRequestId();
}

/** Stable per-request id shared across macros, routes, and error handlers. */
export function getRequestId(request: Request): string {
	let requestId = requestIds.get(request);
	if (!requestId) {
		requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
		requestIds.set(request, requestId);
	}
	return requestId;
}

function attachRequestIdHeader(
	set: { headers?: Record<string, unknown> },
	requestId: string,
) {
	set.headers ??= {};
	set.headers[REQUEST_ID_HEADER] = requestId;
}

export function createRequestIdPlugin() {
	return new Elysia({ name: "request-id" })
		.state("requestId", "")
		.onRequest(({ request, store }) => {
			store.requestId = getRequestId(request);
		})
		.derive({ as: "global" }, ({ store }) => ({
			requestId: store.requestId,
		}))
		.onAfterHandle({ as: "global" }, ({ store, set }) => {
			attachRequestIdHeader(set, store.requestId);
		});
}
