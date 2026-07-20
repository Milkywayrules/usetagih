// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { ApiKeyRepo, AuditRepo } from "@usetagih/core";
import { Elysia } from "elysia";
import {
	generateApiKeySecret,
	hashApiKeySecret,
} from "../../auth/api-key-crypto.js";
import {
	deriveApiKeyStatus,
	formatExternalApiKeyId,
	parseExternalApiKeyId,
} from "../../middleware/auth-context.js";
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

function validationFailed(status: (code: number, body: unknown) => unknown) {
	return status(400, {
		error: {
			code: "VALIDATION_FAILED",
			message: "Request validation failed",
		},
	});
}

export function createApiKeysRoutes(deps: {
	apiKeyRepo: ApiKeyRepo;
	auditRepo: AuditRepo;
}) {
	return new Elysia()
		.post(
			"/api-keys",
			async ({ body, request, status, authContext, userId, workspaceId }) => {
				const sessionGuard = rejectApiKeyManagementAuth(authContext, status);
				if (sessionGuard) {
					return sessionGuard;
				}

				const parsed = CreateApiKeyBodySchema.safeParse(body);
				if (!parsed.success) {
					return validationFailed(status);
				}

				let expiresAt: Date | null = null;
				if (parsed.data.expiresAt) {
					expiresAt = new Date(parsed.data.expiresAt);
					if (expiresAt <= new Date()) {
						return status(400, {
							error: {
								code: "VALIDATION_FAILED",
								message: "expiresAt must be in the future",
							},
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
			async ({ status, authContext }) => {
				const sessionGuard = rejectApiKeyManagementAuth(authContext, status);
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
			async ({ params, request, status, authContext, userId, workspaceId }) => {
				const sessionGuard = rejectApiKeyManagementAuth(authContext, status);
				if (sessionGuard) {
					return sessionGuard;
				}

				const parsedParams = ApiKeyIdParamSchema.safeParse(params);
				if (!parsedParams.success) {
					return validationFailed(status);
				}

				const keyUuid = parseExternalApiKeyId(parsedParams.data.keyId);
				if (!keyUuid) {
					return status(404, {
						error: {
							code: "NOT_FOUND",
							message: "API key not found",
						},
					});
				}

				const existing = await deps.apiKeyRepo.findById(workspaceId, keyUuid);
				if (!existing) {
					return status(404, {
						error: {
							code: "NOT_FOUND",
							message: "API key not found",
						},
					});
				}

				const wasAlreadyRevoked = existing.revokedAt !== null;
				const record = await deps.apiKeyRepo.revoke(workspaceId, keyUuid);
				if (!record) {
					return status(404, {
						error: {
							code: "NOT_FOUND",
							message: "API key not found",
						},
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
