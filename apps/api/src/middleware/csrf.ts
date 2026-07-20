import { createHmac, timingSafeEqual } from "node:crypto";
import { getCsrfKey } from "../auth/crypto-keys.js";

export const CSRF_HEADER = "X-CSRF-Token";

export function csrfCookieName(secure: boolean): string {
	return secure ? "__Host-usetagih.csrf" : "usetagih.csrf";
}

export function isSecureRequest(request: Request): boolean {
	const forwardedProto = request.headers.get("x-forwarded-proto");
	if (forwardedProto) {
		return forwardedProto.split(",")[0]?.trim() === "https";
	}
	try {
		return new URL(request.url).protocol === "https:";
	} catch {
		return false;
	}
}

function signCsrfPayload(
	key: Uint8Array,
	sessionId: string,
	nonce: string,
): string {
	return createHmac("sha256", key)
		.update(`${sessionId}:${nonce}`)
		.digest("hex");
}

export function createCsrfToken(secret: string, sessionId: string): string {
	const nonce = crypto.randomUUID().replace(/-/g, "");
	const key = getCsrfKey(secret);
	const hmac = signCsrfPayload(key, sessionId, nonce);
	return `${nonce}.${hmac}`;
}

export function verifyCsrfToken(
	secret: string,
	sessionId: string,
	token: string,
): boolean {
	const separator = token.lastIndexOf(".");
	if (separator <= 0) {
		return false;
	}

	const nonce = token.slice(0, separator);
	const provided = token.slice(separator + 1);
	if (!nonce || !provided) {
		return false;
	}

	const key = getCsrfKey(secret);
	const expected = signCsrfPayload(key, sessionId, nonce);
	if (expected.length !== provided.length) {
		return false;
	}

	return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function readCsrfCookie(
	request: Request,
	secure: boolean,
): string | null {
	const name = csrfCookieName(secure);
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) {
		return null;
	}

	for (const part of cookieHeader.split(";")) {
		const trimmed = part.trim();
		if (trimmed.startsWith(`${name}=`)) {
			return decodeURIComponent(trimmed.slice(name.length + 1));
		}
	}

	return null;
}

export function appendCsrfCookie(
	set: { headers: Record<string, unknown> },
	request: Request,
	secret: string,
	sessionId: string,
): string {
	const secure = isSecureRequest(request);
	const token = createCsrfToken(secret, sessionId);
	const name = csrfCookieName(secure);
	const flags = secure
		? "Path=/; SameSite=Strict; Secure"
		: "Path=/; SameSite=Strict";
	const cookie = `${name}=${encodeURIComponent(token)}; ${flags}`;

	const existing = set.headers["set-cookie"];
	if (existing) {
		set.headers["set-cookie"] = Array.isArray(existing)
			? [...existing, cookie]
			: [existing, cookie];
	} else {
		set.headers["set-cookie"] = cookie;
	}

	return token;
}

export function validateCsrfDoubleSubmit(
	request: Request,
	secret: string,
	sessionId: string,
): boolean {
	const secure = isSecureRequest(request);
	const headerToken = request.headers.get(CSRF_HEADER);
	const cookieToken = readCsrfCookie(request, secure);

	if (!headerToken || !cookieToken) {
		return false;
	}

	if (headerToken.length !== cookieToken.length) {
		return false;
	}

	if (!timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))) {
		return false;
	}

	return verifyCsrfToken(secret, sessionId, headerToken);
}
