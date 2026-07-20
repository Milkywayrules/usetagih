import { hash, verify } from "@node-rs/argon2";

export const API_KEY_SECRET_PREFIX = "utk_live_" as const;
export const API_KEY_LOOKUP_PREFIX_LENGTH = 16 as const;

export const API_KEY_ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1,
} as const;

export type GeneratedApiKeySecret = {
	secret: string;
	prefix: string;
};

export function generateApiKeySecret(): GeneratedApiKeySecret {
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	const encoded = Buffer.from(randomBytes).toString("base64url");
	const secret = `${API_KEY_SECRET_PREFIX}${encoded}`;
	return {
		secret,
		prefix: extractLookupPrefix(secret),
	};
}

export function extractLookupPrefix(secret: string): string {
	return secret.slice(0, API_KEY_LOOKUP_PREFIX_LENGTH);
}

export async function hashApiKeySecret(secret: string): Promise<string> {
	return hash(secret, API_KEY_ARGON2_OPTIONS);
}

export async function verifyApiKeySecret(
	secret: string,
	keyHash: string,
): Promise<boolean> {
	return verify(keyHash, secret, API_KEY_ARGON2_OPTIONS);
}

export function isApiKeySecretFormat(token: string): boolean {
	return token.startsWith(API_KEY_SECRET_PREFIX) && token.length >= 40;
}
