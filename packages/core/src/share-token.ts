import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ShareTokenPayload = {
	r: string;
	e: number;
	n: string;
};

function toBase64Url(value: string | Buffer): string {
	return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): string {
	return Buffer.from(value, "base64url").toString("utf8");
}

function signPayloadB64(payloadB64: string, secret: string): string {
	return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function verifySignature(
	payloadB64: string,
	signature: string,
	secret: string,
): boolean {
	const expected = signPayloadB64(payloadB64, secret);
	if (signature.length !== expected.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function createShareToken(input: {
	renderId: string;
	expiresAt: Date;
	secret: string;
	nonce?: string;
}): string {
	const payload: ShareTokenPayload = {
		r: input.renderId,
		e: Math.floor(input.expiresAt.getTime() / 1000),
		n: input.nonce ?? randomBytes(16).toString("base64url"),
	};
	const payloadB64 = toBase64Url(JSON.stringify(payload));
	const signature = signPayloadB64(payloadB64, input.secret);
	return `${payloadB64}.${signature}`;
}

export function verifyShareToken(
	token: string,
	secret: string,
): ShareTokenPayload | null {
	const separator = token.lastIndexOf(".");
	if (separator <= 0) {
		return null;
	}

	const payloadB64 = token.slice(0, separator);
	const signature = token.slice(separator + 1);
	if (!verifySignature(payloadB64, signature, secret)) {
		return null;
	}

	try {
		const payload = JSON.parse(fromBase64Url(payloadB64)) as ShareTokenPayload;
		if (
			typeof payload.r !== "string" ||
			typeof payload.e !== "number" ||
			typeof payload.n !== "string"
		) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}

export function buildShareUrl(webPublicUrl: string, token: string): string {
	const baseUrl = webPublicUrl.replace(/\/$/, "");
	return `${baseUrl}/share/${encodeURIComponent(token)}`;
}

export function resolveShareTtlDays(shareTtlDays?: number): number {
	if (shareTtlDays == null) {
		return 90;
	}
	return shareTtlDays;
}

export function computeShareExpiresAt(now: Date, shareTtlDays: number): Date {
	const expiresAt = new Date(now);
	expiresAt.setUTCDate(expiresAt.getUTCDate() + shareTtlDays);
	return expiresAt;
}
