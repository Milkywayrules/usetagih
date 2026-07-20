import { Elysia } from "elysia";

export const API_CONTENT_SECURITY_POLICY =
	"default-src 'none'; frame-ancestors 'none'";

/** Scalar UI needs inline script/style and jsDelivr CDN assets. */
export const DOCS_CONTENT_SECURITY_POLICY =
	"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; frame-ancestors 'self'";

type HeaderSetter = { headers?: Record<string, unknown> };

export function applySecurityHeadersToSet(set: HeaderSetter, path: string) {
	set.headers ??= {};
	set.headers["X-Content-Type-Options"] = "nosniff";
	set.headers["X-Frame-Options"] = "DENY";
	set.headers["Referrer-Policy"] = "no-referrer";
	set.headers["Cross-Origin-Resource-Policy"] = "same-origin";
	set.headers["Content-Security-Policy"] =
		path === "/docs"
			? DOCS_CONTENT_SECURITY_POLICY
			: API_CONTENT_SECURITY_POLICY;
}

function applySecurityHeadersToResponse(
	response: Response,
	path: string,
): Response {
	const headers = new Headers(response.headers);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Referrer-Policy", "no-referrer");
	headers.set("Cross-Origin-Resource-Policy", "same-origin");
	headers.set(
		"Content-Security-Policy",
		path === "/docs"
			? DOCS_CONTENT_SECURITY_POLICY
			: API_CONTENT_SECURITY_POLICY,
	);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function createSecurityHeadersPlugin() {
	return new Elysia({ name: "security-headers" })
		.onAfterHandle({ as: "global" }, ({ request, set }) => {
			applySecurityHeadersToSet(set, new URL(request.url).pathname);
		})
		.mapResponse({ as: "global" }, ({ response, request, set }) => {
			const path = new URL(request.url).pathname;
			if (response instanceof Response) {
				return applySecurityHeadersToResponse(response, path);
			}
			applySecurityHeadersToSet(set, path);
		});
}
