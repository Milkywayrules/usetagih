import type { ApiScope } from "@usetagih/schema";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthContext = {
	authType: "session" | "session_bearer" | "api_key";
	userId?: string;
	workspaceId: string;
	scopes: ApiScope[];
	apiKeyId?: string;
};

export function hasRequiredScopes(
	authContext: AuthContext,
	required: readonly ApiScope[],
): boolean {
	return required.every((scope) => authContext.scopes.includes(scope));
}

export function formatExternalApiKeyId(id: string): string {
	return `key_${id}`;
}

export function parseExternalApiKeyId(keyId: string): string | null {
	const raw = keyId.startsWith("key_") ? keyId.slice("key_".length) : keyId;
	return UUID_PATTERN.test(raw) ? raw : null;
}

export type ApiKeyStatus = "active" | "revoked" | "expired";

export function deriveApiKeyStatus(record: {
	revokedAt: Date | null;
	expiresAt: Date | null;
}): ApiKeyStatus {
	if (record.revokedAt) {
		return "revoked";
	}
	if (record.expiresAt && record.expiresAt <= new Date()) {
		return "expired";
	}
	return "active";
}
