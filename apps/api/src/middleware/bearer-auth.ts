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
	const row = await apiKeyRepo.findByPrefix(prefix);
	if (!row) {
		return null;
	}

	if (row.revokedAt) {
		return null;
	}

	if (row.expiresAt && row.expiresAt <= new Date()) {
		return null;
	}

	const valid = await verifyApiKeySecret(token, row.keyHash);
	if (!valid) {
		return null;
	}

	return {
		authType: "api_key",
		workspaceId: row.workspaceId,
		scopes: row.scopes,
		apiKeyId: row.id,
	};
}
