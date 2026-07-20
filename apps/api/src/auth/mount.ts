import { cors } from "@elysiajs/cors";
import { auth } from "@usetagih/db";
import { Elysia } from "elysia";
import { CSRF_HEADER } from "../middleware/csrf.js";

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
				async resolve({ request: { headers }, status }) {
					const session = await auth.api.getSession({ headers });
					if (!session) {
						return status(401, {
							error: {
								code: "UNAUTHORIZED",
								message: "Authentication required",
							},
						});
					}
					return {
						user: session.user,
						session: session.session,
						workspaceId: session.session.activeOrganizationId ?? null,
					};
				},
			},
		});
}

export { auth };
