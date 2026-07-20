import { cors } from "@elysiajs/cors";
import { auth } from "@usetagih/db";
import { UNAUTHORIZED_CODE } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../lib/api-error.js";
import { CSRF_HEADER } from "../middleware/csrf.js";
import { getRequestId } from "../middleware/request-id.js";

export function createBetterAuthPlugin(options: {
	apiPublicUrl: string;
	webPublicUrl: string;
}) {
	return new Elysia({ name: "better-auth" })
		.use(
			cors({
				origin: options.webPublicUrl,
				methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				credentials: true,
				allowedHeaders: ["Content-Type", "Authorization", CSRF_HEADER],
			}),
		)
		.mount(auth.handler)
		.macro({
			auth: {
				async resolve({
					request,
					status,
					set,
				}: {
					request: Request;
					status: (code: number, body: unknown) => unknown;
					set: { headers?: Record<string, unknown> };
				}) {
					const session = await auth.api.getSession({
						headers: request.headers,
					});
					if (!session) {
						return statusApiError(status, set, {
							code: UNAUTHORIZED_CODE,
							message: "Authentication required",
							requestId: getRequestId(request),
						}) as never;
					}
					return {
						user: session.user,
						session: session.session,
						workspaceId: session.session.activeOrganizationId ?? null,
					};
				},
			},
		} as never);
}

export { auth };
