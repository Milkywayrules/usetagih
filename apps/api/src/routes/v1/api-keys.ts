// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { ApiKeyRepo, AuditRepo } from "@usetagih/core";
import {
	NOT_FOUND_CODE,
	VALIDATION_FAILED_CODE,
	zodIssuesToDetails,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import {
	generateApiKeySecret,
	hashApiKeySecret,
} from "../../auth/api-key-crypto.js";
import { statusApiError } from "../../lib/api-error.js";
import {
	deriveApiKeyStatus,
	formatExternalApiKeyId,
	parseExternalApiKeyId,
} from "../../middleware/auth-context.js";
import { getRequestId } from "../../middleware/request-id.js";
import { rejectApiKeyManagementAuth } from "../../middleware/session-management-auth.js";
import {
	ApiKeyIdParamSchema,
	CreateApiKeyBodySchema,
} from "./api-keys.schemas.js";

function clientIp(request: Request): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		null
	);
}

export function createApiKeysRoutes(deps: {
	apiKeyRepo: ApiKeyRepo;
	auditRepo: AuditRepo;
}) {
	return new Elysia()
		.post(
			"/api-keys",
			async ({
				body,
				request,
				status,
				set,
				authContext,
				userId,
				workspaceId,
			}) => {
				const sessionGuard = rejectApiKeyManagementAuth(
					authContext,
					request,
					status,
					set,
				);
				if (sessionGuard) {
					return sessionGuard;
				}

				const requestId = getRequestId(request);
				const parsed = CreateApiKeyBodySchema.safeParse(body);
				if (!parsed.success) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: zodIssuesToDetails(parsed.error),
					});
				}

				let expiresAt: Date | null = null;
				if (parsed.data.expiresAt) {
					expiresAt = new Date(parsed.data.expiresAt);
					if (expiresAt <= new Date()) {
						return statusApiError(status, set, {
							code: VALIDATION_FAILED_CODE,
							message: "expiresAt must be in the future",
							requestId,
							details: [
								{
									path: "/expiresAt",
									code: VALIDATION_FAILED_CODE,
									message: "expiresAt must be in the future",
								},
							],
						});
					}
				}

				const { secret, prefix } = generateApiKeySecret();
				const keyHash = await hashApiKeySecret(secret);

				const record = await deps.apiKeyRepo.create({
					workspaceId,
					name: parsed.data.name,
					prefix,
					keyHash,
					scopes: parsed.data.scopes,
					expiresAt,
				});

				await deps.auditRepo.append({
					workspaceId,
					userId: userId ?? "",
					action: "api_key.created",
					resourceType: "api_key",
					resourceId: record.id,
					outcome: "success",
					ip: clientIp(request),
				});

				return status(201, {
					id: formatExternalApiKeyId(record.id),
					name: record.name,
					prefix: record.prefix,
					secret,
					scopes: record.scopes,
					expiresAt: record.expiresAt?.toISOString() ?? null,
					createdAt: record.createdAt.toISOString(),
				});
			},
			{ authenticated: true } as never,
		)
		.get(
			"/api-keys",
			async ({ request, status, set, authContext }) => {
				const sessionGuard = rejectApiKeyManagementAuth(
					authContext,
					request,
					status,
					set,
				);
				if (sessionGuard) {
					return sessionGuard;
				}

				const records = await deps.apiKeyRepo.listByWorkspace(
					authContext.workspaceId,
				);

				return {
					keys: records.map((record) => ({
						id: formatExternalApiKeyId(record.id),
						name: record.name,
						prefix: record.prefix,
						scopes: record.scopes,
						expiresAt: record.expiresAt?.toISOString() ?? null,
						revokedAt: record.revokedAt?.toISOString() ?? null,
						createdAt: record.createdAt.toISOString(),
						status: deriveApiKeyStatus(record),
					})),
				};
			},
			{ authenticated: true } as never,
		)
		.delete(
			"/api-keys/:keyId",
			async ({
				params,
				request,
				status,
				set,
				authContext,
				userId,
				workspaceId,
			}) => {
				const sessionGuard = rejectApiKeyManagementAuth(
					authContext,
					request,
					status,
					set,
				);
				if (sessionGuard) {
					return sessionGuard;
				}

				const requestId = getRequestId(request);
				const parsedParams = ApiKeyIdParamSchema.safeParse(params);
				if (!parsedParams.success) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: zodIssuesToDetails(parsedParams.error),
					});
				}

				const keyUuid = parseExternalApiKeyId(parsedParams.data.keyId);
				if (!keyUuid) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "API key not found",
						requestId,
					});
				}

				const existing = await deps.apiKeyRepo.findById(workspaceId, keyUuid);
				if (!existing) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "API key not found",
						requestId,
					});
				}

				const wasAlreadyRevoked = existing.revokedAt !== null;
				const record = await deps.apiKeyRepo.revoke(workspaceId, keyUuid);
				if (!record) {
					return statusApiError(status, set, {
						code: NOT_FOUND_CODE,
						message: "API key not found",
						requestId,
					});
				}

				if (!wasAlreadyRevoked) {
					await deps.auditRepo.append({
						workspaceId,
						userId: userId ?? "",
						action: "api_key.revoked",
						resourceType: "api_key",
						resourceId: record.id,
						outcome: "success",
						ip: clientIp(request),
					});
				}

				return {
					id: formatExternalApiKeyId(record.id),
					revokedAt: record.revokedAt?.toISOString() ?? null,
				};
			},
			{ authenticated: true } as never,
		);
}
