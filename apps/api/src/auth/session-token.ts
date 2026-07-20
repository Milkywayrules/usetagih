import {
	type ApiScope,
	ApiScopeArraySchema,
	SESSION_TOKEN_SCOPES,
} from "@usetagih/schema";
import { jwtVerify, SignJWT } from "jose";
import type { ApiEnv } from "../env.js";
import { getSessionBearerKey } from "./crypto-keys.js";

export const SESSION_TOKEN_TTL_SECONDS = 900;
export const SESSION_TOKEN_TYP = "session_bearer" as const;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SessionBearerClaims = {
	sub: string;
	wid: string;
	scp: ApiScope[];
	aud: string;
	azp: string;
	iss: string;
	exp: number;
	iat: number;
	jti: string;
	typ: typeof SESSION_TOKEN_TYP;
};

export type VerifiedSessionBearer = {
	userId: string;
	workspaceId: string;
	scopes: ApiScope[];
	claims: SessionBearerClaims;
};

const scopeSchema = ApiScopeArraySchema;

export async function signSessionBearerToken(
	input: {
		userId: string;
		workspaceId: string;
		scopes?: readonly ApiScope[];
	},
	env: Pick<
		ApiEnv,
		"BETTER_AUTH_SECRET" | "USETAGIH_API_PUBLIC_URL" | "USETAGIH_WEB_PUBLIC_URL"
	>,
): Promise<{ accessToken: string; expiresIn: number; jti: string }> {
	const key = getSessionBearerKey(env.BETTER_AUTH_SECRET);
	const scopes = [...(input.scopes ?? SESSION_TOKEN_SCOPES)];
	const jti = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	const accessToken = await new SignJWT({
		wid: input.workspaceId,
		scp: scopes,
		azp: env.USETAGIH_WEB_PUBLIC_URL,
		typ: SESSION_TOKEN_TYP,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(input.userId)
		.setAudience(env.USETAGIH_API_PUBLIC_URL)
		.setIssuer(env.USETAGIH_API_PUBLIC_URL)
		.setIssuedAt(now)
		.setExpirationTime(now + SESSION_TOKEN_TTL_SECONDS)
		.setJti(jti)
		.sign(key);

	return { accessToken, expiresIn: SESSION_TOKEN_TTL_SECONDS, jti };
}

function parseRequiredString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export async function verifySessionBearerToken(
	token: string,
	env: Pick<
		ApiEnv,
		"BETTER_AUTH_SECRET" | "USETAGIH_API_PUBLIC_URL" | "USETAGIH_WEB_PUBLIC_URL"
	>,
): Promise<VerifiedSessionBearer | null> {
	const key = getSessionBearerKey(env.BETTER_AUTH_SECRET);

	try {
		const { payload } = await jwtVerify(token, key, {
			algorithms: ["HS256"],
			issuer: env.USETAGIH_API_PUBLIC_URL,
			audience: env.USETAGIH_API_PUBLIC_URL,
			clockTolerance: 30,
		});

		const sub = parseRequiredString(payload.sub);
		const wid = parseRequiredString(payload.wid);
		const jti = parseRequiredString(payload.jti);
		const typ = payload.typ;
		const azp = parseRequiredString(payload.azp);
		const iat = payload.iat;
		const exp = payload.exp;

		if (
			!sub ||
			!wid ||
			!jti ||
			typ !== SESSION_TOKEN_TYP ||
			azp !== env.USETAGIH_WEB_PUBLIC_URL ||
			typeof iat !== "number" ||
			typeof exp !== "number"
		) {
			return null;
		}

		if (iat > Math.floor(Date.now() / 1000) + 30) {
			return null;
		}

		if (!UUID_RE.test(wid)) {
			return null;
		}

		const parsedScopes = scopeSchema.safeParse(payload.scp);
		if (!parsedScopes.success) {
			return null;
		}

		const claims: SessionBearerClaims = {
			sub,
			wid,
			scp: parsedScopes.data,
			aud: env.USETAGIH_API_PUBLIC_URL,
			azp,
			iss: env.USETAGIH_API_PUBLIC_URL,
			exp,
			iat,
			jti,
			typ: SESSION_TOKEN_TYP,
		};

		return {
			userId: sub,
			workspaceId: wid,
			scopes: parsedScopes.data,
			claims,
		};
	} catch {
		return null;
	}
}

/** Test-only helper for parity matrix subset-scope cases. */
export async function signSessionBearerTokenRaw(
	payload: Record<string, unknown>,
	env: Pick<ApiEnv, "BETTER_AUTH_SECRET" | "USETAGIH_API_PUBLIC_URL">,
	options?: { algorithm?: string; omitClaims?: string[] },
): Promise<string> {
	const key = getSessionBearerKey(env.BETTER_AUTH_SECRET);
	const algorithm = options?.algorithm ?? "HS256";
	const body = { ...payload };
	for (const claim of options?.omitClaims ?? []) {
		delete body[claim];
	}

	const jwt = new SignJWT(body as Record<string, unknown>).setProtectedHeader({
		alg: algorithm,
	});

	if (typeof body.sub === "string") {
		jwt.setSubject(body.sub);
	}
	if (typeof body.aud === "string") {
		jwt.setAudience(body.aud);
	}
	if (typeof body.iss === "string") {
		jwt.setIssuer(body.iss);
	}
	if (typeof body.iat === "number") {
		jwt.setIssuedAt(body.iat);
	} else {
		jwt.setIssuedAt(Math.floor(Date.now() / 1000));
	}
	if (typeof body.exp === "number") {
		jwt.setExpirationTime(body.exp);
	}
	if (typeof body.jti === "string") {
		jwt.setJti(body.jti);
	}

	return jwt.sign(key);
}
