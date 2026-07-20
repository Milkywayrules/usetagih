import type { IngestedLogo, LogoContentType } from "@usetagih/core";
import { computeLogoChecksum } from "../render-record.js";
import { sanitizeSvgLogo } from "../svg-sanitize.js";
import { type FetchLogoDeps, fetchLogoSsrfSafe } from "./fetch-logo.js";
import { sniffLogoContentType } from "./validate-content.js";

export type IngestLogoResult =
	| { ok: true; logo: IngestedLogo }
	| { ok: false; reason: string };

export type IngestLogoDeps = FetchLogoDeps;

const CONTENT_EXT: Record<LogoContentType, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/svg+xml": "svg",
};

export function buildLogoStorageKey(
	workspaceId: string,
	logoChecksum: string,
	contentType: LogoContentType,
): string {
	const ext = CONTENT_EXT[contentType];
	return `logos/${workspaceId}/${logoChecksum}.${ext}`;
}

export async function ingestLogoFromUrl(
	url: string,
	workspaceId: string,
	deps: IngestLogoDeps = {},
): Promise<IngestLogoResult> {
	const fetched = await fetchLogoSsrfSafe(url, deps);
	if (!fetched.ok) {
		return { ok: false, reason: fetched.reason };
	}

	let bytes = fetched.bytes;
	const sniff = sniffLogoContentType(bytes);
	if (!sniff.ok) {
		return { ok: false, reason: sniff.reason };
	}

	if (sniff.contentType === "image/svg+xml") {
		const sanitized = sanitizeSvgLogo(bytes);
		if (!sanitized.ok) {
			return { ok: false, reason: sanitized.errors.join("; ") };
		}
		bytes = Buffer.from(sanitized.sanitized);
	}

	const logoChecksum = computeLogoChecksum(bytes);
	const storageKey = buildLogoStorageKey(
		workspaceId,
		logoChecksum,
		sniff.contentType,
	);

	return {
		ok: true,
		logo: {
			bytes,
			logoChecksum,
			contentType: sniff.contentType,
			storageKey,
		},
	};
}
