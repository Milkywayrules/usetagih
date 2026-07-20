import { hkdfSync } from "node:crypto";

const SESSION_BEARER_INFO = "usetagih:session_bearer:v1";
const CSRF_INFO = "usetagih:csrf:v1";

function deriveKey(secret: string, info: string): Uint8Array {
	return new Uint8Array(hkdfSync("sha256", secret, "", info, 32));
}

export function getSessionBearerKey(secret: string): Uint8Array {
	return deriveKey(secret, SESSION_BEARER_INFO);
}

export function getCsrfKey(secret: string): Uint8Array {
	return deriveKey(secret, CSRF_INFO);
}
