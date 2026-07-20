import { describe, expect, test } from "bun:test";
import {
	API_KEY_LOOKUP_PREFIX_LENGTH,
	API_KEY_SECRET_PREFIX,
	extractLookupPrefix,
	generateApiKeySecret,
	hashApiKeySecret,
	verifyApiKeySecret,
} from "../auth/api-key-crypto.js";

describe("api key crypto", () => {
	test("generateApiKeySecret produces utk_live_ prefix and 16-char lookup prefix", () => {
		const { secret, prefix } = generateApiKeySecret();
		expect(secret.startsWith(API_KEY_SECRET_PREFIX)).toBe(true);
		expect(secret.length).toBeGreaterThanOrEqual(40);
		expect(prefix).toBe(secret.slice(0, API_KEY_LOOKUP_PREFIX_LENGTH));
		expect(extractLookupPrefix(secret)).toBe(prefix);
	});

	test("hashApiKeySecret does not equal plaintext", async () => {
		const { secret } = generateApiKeySecret();
		const keyHash = await hashApiKeySecret(secret);
		expect(keyHash).not.toBe(secret);
		expect(keyHash.includes(secret)).toBe(false);
	});

	test("verifyApiKeySecret roundtrip", async () => {
		const { secret } = generateApiKeySecret();
		const keyHash = await hashApiKeySecret(secret);
		expect(await verifyApiKeySecret(secret, keyHash)).toBe(true);
		expect(await verifyApiKeySecret(`${secret}x`, keyHash)).toBe(false);
	});
});
