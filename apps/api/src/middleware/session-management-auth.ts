import { FORBIDDEN_CODE } from "@usetagih/schema";
import { statusApiError } from "../lib/api-error.js";
import type { AuthContext } from "./auth-context.js";
import { getRequestId } from "./request-id.js";

export function rejectApiKeyManagementAuth(
	authContext: AuthContext,
	request: Request,
	status: (code: number, body: unknown) => unknown,
	set: { headers?: Record<string, unknown> },
) {
	if (authContext.authType === "api_key") {
		return statusApiError(status, set, {
			code: FORBIDDEN_CODE,
			message: "API key management requires session authentication",
			requestId: getRequestId(request),
		});
	}

	return null;
}
