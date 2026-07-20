import { expect, test } from "bun:test";
import {
	buildShareUrl,
	computeShareExpiresAt,
	createShareToken,
	resolveShareTtlDays,
	verifyShareToken,
} from "./share-token.js";

const SECRET = "dev-only-share-signing-secret-min-32-chars";
const RENDER_ID = "00000000-0000-4000-8000-000000000099";
const NOW = new Date("2026-07-20T00:00:00.000Z");

test("createShareToken and verifyShareToken round-trip", () => {
	const expiresAt = computeShareExpiresAt(NOW, 90);
	const token = createShareToken({
		renderId: RENDER_ID,
		expiresAt,
		secret: SECRET,
		nonce: "fixed-nonce",
	});

	const payload = verifyShareToken(token, SECRET);
	expect(payload).toEqual({
		r: RENDER_ID,
		e: Math.floor(expiresAt.getTime() / 1000),
		n: "fixed-nonce",
	});
});

test("verifyShareToken rejects tampered signature", () => {
	const token = createShareToken({
		renderId: RENDER_ID,
		expiresAt: computeShareExpiresAt(NOW, 30),
		secret: SECRET,
		nonce: "nonce",
	});
	const tampered = `${token.slice(0, -1)}x`;
	expect(verifyShareToken(tampered, SECRET)).toBeNull();
});

test("verifyShareToken rejects wrong secret", () => {
	const token = createShareToken({
		renderId: RENDER_ID,
		expiresAt: computeShareExpiresAt(NOW, 30),
		secret: SECRET,
	});
	expect(
		verifyShareToken(token, "other-secret-min-32-characters-long"),
	).toBeNull();
});

test("verifyShareToken rejects malformed token", () => {
	expect(verifyShareToken("not-a-token", SECRET)).toBeNull();
});

test("buildShareUrl encodes token for web route", () => {
	const token = "abc.def";
	expect(buildShareUrl("https://app.example.com/", token)).toBe(
		"https://app.example.com/share/abc.def",
	);
});

test("resolveShareTtlDays defaults to 90", () => {
	expect(resolveShareTtlDays()).toBe(90);
	expect(resolveShareTtlDays(30)).toBe(30);
});

test("computeShareExpiresAt adds ttl days in UTC", () => {
	const expiresAt = computeShareExpiresAt(NOW, 7);
	expect(expiresAt.toISOString()).toBe("2026-07-27T00:00:00.000Z");
});
