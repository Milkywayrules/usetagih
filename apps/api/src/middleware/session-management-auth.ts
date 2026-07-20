import type { AuthContext } from "./auth-context.js";

export function rejectApiKeyManagementAuth(
	authContext: AuthContext,
	status: (code: number, body: unknown) => unknown,
) {
	if (authContext.authType === "api_key") {
		return status(403, {
			error: {
				code: "FORBIDDEN",
				message: "API key management requires session authentication",
			},
		});
	}

	return null;
}
