const PRINTABLE_ASCII_IDEMPOTENCY_KEY = /^[\x20-\x7E]{1,255}$/;

export type IdempotencyKeyValidation =
	| { valid: true; key: string }
	| { valid: false; reason: "missing" | "invalid" };

export function validateIdempotencyKeyHeader(
	value: string | null | undefined,
): IdempotencyKeyValidation {
	if (value == null || value === "") {
		return { valid: false, reason: "missing" };
	}
	if (!PRINTABLE_ASCII_IDEMPOTENCY_KEY.test(value)) {
		return { valid: false, reason: "invalid" };
	}
	return { valid: true, key: value };
}

export async function hashIdempotencyKey(key: string): Promise<string> {
	return sha256LowerHex(key);
}

export async function hashRequestBody(rawBody: string): Promise<string> {
	return sha256LowerHex(rawBody);
}

async function sha256LowerHex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
