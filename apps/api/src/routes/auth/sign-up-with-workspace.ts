import type { AuditRepo } from "@usetagih/core";
import { auth } from "@usetagih/db";
import {
	IDEMPOTENCY_CONFLICT_CODE,
	INVALID_REQUEST_CODE,
	UNAUTHORIZED_CODE,
	zodIssuesToDetails,
} from "@usetagih/schema";
import { isAPIError } from "better-auth/api";
import { Elysia } from "elysia";
import { z } from "zod";
import type { ApiEnv } from "../../env.js";
import { respondApiErrorFromContext } from "../../lib/api-error.js";
import { appendCsrfCookie } from "../../middleware/csrf.js";
import { getRequestId } from "../../middleware/request-id.js";

const signUpWithWorkspaceBody = z.object({
	email: z.email(),
	password: z.string().min(8),
	name: z.string().trim().min(1),
	workspaceName: z.string().trim().min(1).max(100),
	workspaceSlug: z
		.string()
		.trim()
		.min(3)
		.max(48)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid workspace slug"),
});

class AuthCookieJar {
	private readonly cookies = new Map<string, string>();
	private readonly setCookieLines: string[] = [];

	absorbResponse(headers: Headers) {
		for (const line of headers.getSetCookie()) {
			this.setCookieLines.push(line);
			const pair = line.split(";")[0];
			const separator = pair?.indexOf("=");
			if (pair && separator != null && separator > 0) {
				this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
			}
		}
	}

	requestHeaders(base: Headers): Headers {
		const headers = new Headers(base);
		if (this.cookies.size > 0) {
			headers.set(
				"cookie",
				[...this.cookies.entries()]
					.map(([name, value]) => `${name}=${value}`)
					.join("; "),
			);
		}
		return headers;
	}

	applyToResponse(set: { headers: Record<string, unknown> }) {
		for (const cookie of this.setCookieLines) {
			const existing = set.headers["set-cookie"];
			if (existing) {
				set.headers["set-cookie"] = Array.isArray(existing)
					? [...existing, cookie]
					: [existing, cookie];
			} else {
				set.headers["set-cookie"] = cookie;
			}
		}
	}
}

function clientIp(request: Request): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		null
	);
}

export function createSignUpWithWorkspaceRoute(deps: {
	auditRepo: AuditRepo;
	env: ApiEnv;
}) {
	return new Elysia().post(
		"/api/auth/sign-up-with-workspace",
		async ({ body, request, set }) => {
			const requestId = getRequestId(request);
			const parsed = signUpWithWorkspaceBody.safeParse(body);
			if (!parsed.success) {
				return respondApiErrorFromContext(
					{ set, requestId },
					{
						code: INVALID_REQUEST_CODE,
						message: "Invalid request body",
						details: zodIssuesToDetails(parsed.error),
					},
				);
			}

			const { email, password, name, workspaceName, workspaceSlug } =
				parsed.data;
			const ip = clientIp(request);
			const jar = new AuthCookieJar();

			try {
				const signUp = await auth.api.signUpEmail({
					body: { email, password, name },
					headers: jar.requestHeaders(new Headers(request.headers)),
					returnHeaders: true,
				});
				jar.absorbResponse(signUp.headers);

				const org = await auth.api.createOrganization({
					body: { name: workspaceName, slug: workspaceSlug },
					headers: jar.requestHeaders(new Headers()),
					returnHeaders: true,
				});
				jar.absorbResponse(org.headers);

				const active = await auth.api.setActiveOrganization({
					body: { organizationId: org.response.id },
					headers: jar.requestHeaders(new Headers()),
					returnHeaders: true,
				});
				jar.absorbResponse(active.headers);

				const session = await auth.api.getSession({
					headers: jar.requestHeaders(new Headers()),
				});

				await deps.auditRepo.append({
					action: "signup",
					workspaceId: null,
					userId: signUp.response.user.id,
					outcome: "success",
					ip,
				});

				jar.applyToResponse(set);

				if (session?.session?.id) {
					appendCsrfCookie(
						set,
						request,
						deps.env.BETTER_AUTH_SECRET,
						session.session.id,
					);
				}

				return {
					user: signUp.response.user,
					session: session?.session ?? null,
					workspaceId: org.response.id,
				};
			} catch (error) {
				// Partial failure: signUpEmail may succeed while org bootstrap fails — user
				// can recover via POST /api/auth/organization/create + set-active (Story 3.18).
				if (isAPIError(error)) {
					const message = error.message.toLowerCase();
					if (
						message.includes("slug") ||
						message.includes("already exists") ||
						message.includes("unique")
					) {
						return respondApiErrorFromContext(
							{ set, requestId },
							{
								code: IDEMPOTENCY_CONFLICT_CODE,
								message: "Workspace slug already taken",
							},
						);
					}
					return respondApiErrorFromContext(
						{ set, requestId },
						{
							code: UNAUTHORIZED_CODE,
							message: "Sign-up failed",
						},
					);
				}

				throw error;
			}
		},
	);
}
