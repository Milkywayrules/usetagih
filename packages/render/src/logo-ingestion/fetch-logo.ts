import { lookup as defaultLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import type { LogoContentType } from "@usetagih/core";
import { isBlockedHostname, isBlockedIpAddress } from "./private-ip.js";
import { sniffLogoContentType } from "./validate-content.js";

const MAX_RAW_BYTES = 2_097_152;
const MAX_DECOMPRESSED_BYTES = 10_485_760;
const DEFAULT_MAX_REDIRECTS = 3;

export type FetchLogoSuccess = {
	ok: true;
	bytes: Buffer;
	contentType: LogoContentType;
};

export type FetchLogoFailure = {
	ok: false;
	reason: string;
};

export type FetchLogoResult = FetchLogoSuccess | FetchLogoFailure;

export type DnsAddress = { address: string; family: number };

export type FetchLogoDeps = {
	lookup?: (hostname: string) => Promise<DnsAddress[]>;
	maxRedirects?: number;
	/** Test hook: after SSRF validation, connect to this host/port (mock HTTPS server). */
	testConnectOverride?: {
		host: string;
		port: number;
		rejectUnauthorized?: boolean;
	};
	/** Test hook: bypass network and return a synthetic response after URL validation. */
	requestImpl?: (url: URL) => Promise<HttpsResponse | FetchLogoFailure>;
};

type HttpsResponse = {
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	body: Buffer;
};

function headerValue(
	headers: Record<string, string | string[] | undefined>,
	name: string,
): string | undefined {
	const value = headers[name.toLowerCase()];
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

function validateHttpsUrl(url: string): URL | FetchLogoFailure {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, reason: "logoUrl must be a valid URL" };
	}

	if (parsed.protocol !== "https:") {
		return { ok: false, reason: "logoUrl must use https scheme" };
	}

	if (!parsed.hostname) {
		return { ok: false, reason: "logoUrl must include a hostname" };
	}

	if (isBlockedHostname(parsed.hostname)) {
		return {
			ok: false,
			reason: "logoUrl hostname resolves to a blocked address",
		};
	}

	return parsed;
}

async function resolveAndValidateHost(
	hostname: string,
	lookup: (hostname: string) => Promise<DnsAddress[]>,
): Promise<{ ok: true; pinnedAddress: string } | FetchLogoFailure> {
	if (isBlockedHostname(hostname)) {
		return {
			ok: false,
			reason: "logoUrl hostname resolves to a blocked address",
		};
	}

	let records: DnsAddress[];
	try {
		records = await lookup(hostname);
	} catch {
		return { ok: false, reason: "logoUrl hostname DNS lookup failed" };
	}

	if (records.length === 0) {
		return {
			ok: false,
			reason: "logoUrl hostname DNS lookup returned no addresses",
		};
	}

	for (const record of records) {
		if (isBlockedIpAddress(record.address)) {
			return {
				ok: false,
				reason: `logoUrl hostname resolves to blocked address ${record.address}`,
			};
		}
	}

	// Resolve-then-connect IP pinning: connect to the first validated address while
	// preserving SNI/Host for the original hostname (mitigates DNS rebinding).
	return { ok: true, pinnedAddress: records[0].address };
}

function decodeContentEncoding(
	rawBody: Buffer,
	contentEncoding: string | undefined,
): Buffer | FetchLogoFailure {
	if (!contentEncoding || contentEncoding === "identity") {
		if (rawBody.length > MAX_DECOMPRESSED_BYTES) {
			return {
				ok: false,
				reason: "logo response exceeds maximum decompressed size",
			};
		}
		return rawBody;
	}

	const encoding = contentEncoding.toLowerCase();
	try {
		let decompressed: Buffer;
		if (encoding === "gzip") {
			decompressed = gunzipSync(rawBody, {
				maxOutputLength: MAX_DECOMPRESSED_BYTES,
			});
		} else if (encoding === "deflate") {
			decompressed = inflateSync(rawBody, {
				maxOutputLength: MAX_DECOMPRESSED_BYTES,
			});
		} else if (encoding === "br") {
			decompressed = brotliDecompressSync(rawBody, {
				maxOutputLength: MAX_DECOMPRESSED_BYTES,
			});
		} else {
			return { ok: false, reason: `unsupported content-encoding: ${encoding}` };
		}
		return decompressed;
	} catch {
		return {
			ok: false,
			reason: "logo response decompression failed or exceeded size limit",
		};
	}
}

async function streamBodyWithLimit(
	stream: NodeJS.ReadableStream,
	maxBytes: number,
): Promise<Buffer | FetchLogoFailure> {
	const chunks: Buffer[] = [];
	let total = 0;

	return new Promise((resolve) => {
		stream.on("data", (chunk: Buffer | string) => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			total += buffer.length;
			if (total > maxBytes) {
				if ("destroy" in stream && typeof stream.destroy === "function") {
					stream.destroy();
				}
				resolve({
					ok: false,
					reason: "logo response exceeds maximum raw size",
				});
				return;
			}
			chunks.push(buffer);
		});
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", () =>
			resolve({ ok: false, reason: "logo response stream failed" }),
		);
	});
}

function httpsGet(
	url: URL,
	pinnedAddress: string,
	deps: FetchLogoDeps,
): Promise<HttpsResponse> {
	return new Promise((resolve, reject) => {
		const connectHost = deps.testConnectOverride?.host ?? pinnedAddress;
		const connectPort =
			deps.testConnectOverride?.port ?? (url.port ? Number(url.port) : 443);
		const path = `${url.pathname}${url.search}`;

		const req = httpsRequest(
			{
				host: connectHost,
				port: connectPort,
				path,
				method: "GET",
				headers: {
					Host: url.host,
					Accept: "image/png,image/jpeg,image/svg+xml,*/*;q=0.8",
				},
				servername: url.hostname,
				rejectUnauthorized:
					deps.testConnectOverride?.rejectUnauthorized ?? true,
			},
			(res) => {
				void (async () => {
					try {
						const bodyResult = await streamBodyWithLimit(res, MAX_RAW_BYTES);
						if (!Buffer.isBuffer(bodyResult)) {
							res.destroy();
							reject(new Error(bodyResult.reason));
							return;
						}
						resolve({
							statusCode: res.statusCode ?? 500,
							headers: res.headers as Record<
								string,
								string | string[] | undefined
							>,
							body: bodyResult,
						});
					} catch (error) {
						reject(error);
					}
				})();
			},
		);

		req.on("error", reject);
		req.end();
	});
}

async function fetchOnce(
	url: URL,
	deps: FetchLogoDeps,
): Promise<HttpsResponse | FetchLogoFailure> {
	const lookup =
		deps.lookup ??
		(async (hostname: string) =>
			defaultLookup(hostname, { all: true, verbatim: true }));
	const resolved = await resolveAndValidateHost(url.hostname, lookup);
	if (!resolved.ok) {
		return resolved;
	}

	if (deps.requestImpl) {
		return deps.requestImpl(url);
	}

	try {
		return await httpsGet(url, resolved.pinnedAddress, deps);
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "logo fetch failed",
		};
	}
}

export async function fetchLogoSsrfSafe(
	url: string,
	deps: FetchLogoDeps = {},
): Promise<FetchLogoResult> {
	const maxRedirects = deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	let currentUrl = validateHttpsUrl(url);
	if (!("protocol" in currentUrl)) {
		return currentUrl;
	}

	for (
		let redirectCount = 0;
		redirectCount <= maxRedirects;
		redirectCount += 1
	) {
		const response = await fetchOnce(currentUrl, deps);
		if ("ok" in response && response.ok === false) {
			return response;
		}

		const { statusCode, headers, body } = response as HttpsResponse;
		if (statusCode >= 300 && statusCode < 400) {
			if (redirectCount >= maxRedirects) {
				return { ok: false, reason: "logo fetch exceeded redirect limit" };
			}
			const location = headerValue(headers, "location");
			if (!location) {
				return {
					ok: false,
					reason: "logo fetch redirect missing Location header",
				};
			}
			const nextUrl = validateHttpsUrl(
				new URL(location, currentUrl).toString(),
			);
			if (!("protocol" in nextUrl)) {
				return nextUrl;
			}
			currentUrl = nextUrl;
			continue;
		}

		if (statusCode < 200 || statusCode >= 300) {
			return { ok: false, reason: `logo fetch failed with HTTP ${statusCode}` };
		}

		const decoded = decodeContentEncoding(
			body,
			headerValue(headers, "content-encoding"),
		);
		if (!Buffer.isBuffer(decoded)) {
			return decoded;
		}

		const sniff = sniffLogoContentType(decoded);
		if (!sniff.ok) {
			return { ok: false, reason: sniff.reason };
		}

		return { ok: true, bytes: decoded, contentType: sniff.contentType };
	}

	return { ok: false, reason: "logo fetch exceeded redirect limit" };
}
