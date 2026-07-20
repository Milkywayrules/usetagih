// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { IdempotencyStore } from "@usetagih/core";
import {
	IDEMPOTENCY_CONFLICT_CODE,
	INVALID_REQUEST_CODE,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import { respondApiError } from "../lib/api-error.js";
import {
	hashIdempotencyKey,
	hashRequestBody,
	validateIdempotencyKeyHeader,
} from "../lib/idempotency-crypto.js";
import { getRequestId } from "./request-id.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyRouteContext = {
	keyHash: string;
	requestHash: string;
	endpoint: string;
	cacheHit: boolean;
	rawBody: string;
};

const idempotencyContextByRequest = new WeakMap<
	Request,
	IdempotencyRouteContext
>();

const rawBodyByRequest = new WeakMap<Request, string>();

async function readRawRequestBody(request: Request): Promise<string> {
	const cached = rawBodyByRequest.get(request);
	if (cached !== undefined) {
		return cached;
	}
	const rawBody = await request.clone().text();
	rawBodyByRequest.set(request, rawBody);
	return rawBody;
}

function normalizeResponseBody(response: unknown): unknown {
	if (
		typeof response === "object" &&
		response !== null &&
		"response" in response
	) {
		return (response as { response: unknown }).response;
	}
	return response;
}

type RenderRouteHandler = (context: {
	status: (code: number, body: unknown) => unknown;
}) => unknown;

export function getIdempotencyContext(
	request: Request,
): IdempotencyRouteContext | undefined {
	return idempotencyContextByRequest.get(request);
}

export function createIdempotencyMiddleware(options: {
	idempotencyStore: IdempotencyStore;
	documentTypePath: string;
	handler: RenderRouteHandler;
}) {
	const endpoint = `POST /v1/${options.documentTypePath}/render`;

	return new Elysia({ name: `idempotency-${options.documentTypePath}` })
		.onBeforeHandle(async (ctx) => {
			const request = ctx.request;
			const set = ctx.set;
			const workspaceId = ctx.workspaceId as string | undefined;
			const requestId = getRequestId(request);
			const rawBody = await readRawRequestBody(request);
			const requestHash = await hashRequestBody(rawBody);

			const keyValidation = validateIdempotencyKeyHeader(
				request.headers.get("Idempotency-Key"),
			);

			if (!keyValidation.valid) {
				const message =
					keyValidation.reason === "missing"
						? "Idempotency-Key header is required"
						: "Idempotency-Key must be 1-255 printable ASCII characters";
				return respondApiError({
					set,
					code: INVALID_REQUEST_CODE,
					message,
					requestId,
					request,
					details: [],
				});
			}

			if (!workspaceId) {
				return;
			}

			const keyHash = await hashIdempotencyKey(keyValidation.key);
			const lookup = await options.idempotencyStore.lookup({
				workspaceId,
				endpoint,
				keyHash,
			});

			if (lookup.status === "hit") {
				if (lookup.requestHash !== requestHash) {
					return respondApiError({
						set,
						code: IDEMPOTENCY_CONFLICT_CODE,
						message:
							"Idempotency key was previously used with a different request body",
						requestId,
						request,
						details: [],
					});
				}

				set.status = 201;
				idempotencyContextByRequest.set(request, {
					keyHash,
					requestHash,
					endpoint,
					cacheHit: true,
					rawBody,
				});
				return normalizeResponseBody(lookup.responseBody);
			}

			idempotencyContextByRequest.set(request, {
				keyHash,
				requestHash,
				endpoint,
				cacheHit: false,
				rawBody,
			});
		})
		.onAfterHandle(async (ctx) => {
			const request = ctx.request;
			const set = ctx.set;
			const workspaceId = ctx.workspaceId as string | undefined;
			const response = ctx.response;
			const routeContext = idempotencyContextByRequest.get(request);

			if (!routeContext || routeContext.cacheHit || !workspaceId) {
				return;
			}

			const statusCode =
				typeof set.status === "number" ? set.status : Number(set.status ?? 200);
			if (statusCode < 200 || statusCode >= 300) {
				return;
			}

			const responseBody = normalizeResponseBody(response);

			await options.idempotencyStore.store({
				workspaceId,
				endpoint: routeContext.endpoint,
				keyHash: routeContext.keyHash,
				requestHash: routeContext.requestHash,
				responseBody,
				expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
			});

			const reload = await options.idempotencyStore.lookup({
				workspaceId,
				endpoint: routeContext.endpoint,
				keyHash: routeContext.keyHash,
			});
			if (reload.status === "hit") {
				const winnerBody = normalizeResponseBody(reload.responseBody);
				const winnerRenderId =
					typeof winnerBody === "object" &&
					winnerBody !== null &&
					"renderId" in winnerBody
						? (winnerBody as { renderId: unknown }).renderId
						: undefined;
				const localRenderId =
					typeof responseBody === "object" &&
					responseBody !== null &&
					"renderId" in responseBody
						? (responseBody as { renderId: unknown }).renderId
						: undefined;
				if (
					winnerRenderId !== undefined &&
					localRenderId !== undefined &&
					winnerRenderId !== localRenderId
				) {
					set.status = statusCode;
					return winnerBody;
				}
			}
		})
		.post(`/${options.documentTypePath}/render`, options.handler, {
			authenticated: true,
			requireScope: "renders:write",
		} as never);
}
