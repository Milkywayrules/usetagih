import type { ApiKeyRepo } from "@usetagih/core";
import {
	isApiKeySecretFormat,
	verifyApiKeySecret,
} from "../auth/api-key-crypto.js";
import { verifySessionBearerToken } from "../auth/session-token.js";
import type { ApiEnv } from "../env.js";
import type { AuthContext } from "./auth-context.js";

export async function resolveBearerAuth(
	authorization: string | null,
	env: ApiEnv,
	apiKeyRepo: ApiKeyRepo,
): Promise<AuthContext | null> {
	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	const token = authorization.slice("Bearer ".length).trim();
	if (!token) {
		return null;
	}

	if (token.includes(".")) {
		const verified = await verifySessionBearerToken(token, env);
		if (!verified) {
			return null;
		}

		return {
			authType: "session_bearer",
			userId: verified.userId,
			workspaceId: verified.workspaceId,
			scopes: verified.scopes,
		};
	}

	return verifyApiKeyBearer(token, apiKeyRepo);
}

async function verifyApiKeyBearer(
	token: string,
	apiKeyRepo: ApiKeyRepo,
): Promise<AuthContext | null> {
	if (!isApiKeySecretFormat(token)) {
		return null;
	}

	const prefix = token.slice(0, 16);
	const candidates = await apiKeyRepo.findByPrefix(prefix);
	if (candidates.length === 0) {
		return null;
	}

	const now = new Date();
	for (const row of candidates) {
		if (row.revokedAt) {
			continue;
		}

		if (row.expiresAt && row.expiresAt <= now) {
			continue;
		}

		const valid = await verifyApiKeySecret(token, row.keyHash);
		if (!valid) {
			continue;
		}

		return {
			authType: "api_key",
			workspaceId: row.workspaceId,
			scopes: row.scopes,
			apiKeyId: row.id,
		};
	}

	return null;
}
