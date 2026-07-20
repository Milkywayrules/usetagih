import { verifySessionBearerToken } from "../auth/session-token.js";
import type { ApiEnv } from "../env.js";
import type { AuthContext } from "./auth-context.js";

export async function resolveBearerAuth(
	authorization: string | null,
	env: ApiEnv,
): Promise<AuthContext | null> {
	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	const token = authorization.slice("Bearer ".length).trim();
	if (!token) {
		return null;
	}

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
