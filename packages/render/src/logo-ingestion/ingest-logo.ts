import type { IngestedLogo, LogoContentType } from "@usetagih/core";
import { computeLogoChecksum } from "../render-record.js";
import { sanitizeSvgLogo } from "../svg-sanitize.js";
import { type FetchLogoDeps, fetchLogoSsrfSafe } from "./fetch-logo.js";
import { sniffLogoContentType } from "./validate-content.js";

export type IngestLogoResult =
	| { ok: true; logo: IngestedLogo }
	| { ok: false; reason: string };

export type IngestLogoDeps = FetchLogoDeps;

export const MAX_LOGO_BYTES = 2_097_152;

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

export async function ingestLogoFromBytes(
	bytesInput: Uint8Array | Buffer,
	workspaceId: string,
): Promise<IngestLogoResult> {
	const bytes = Buffer.isBuffer(bytesInput)
		? bytesInput
		: Buffer.from(bytesInput);

	if (bytes.byteLength === 0) {
		return { ok: false, reason: "logo file is empty" };
	}
	if (bytes.byteLength > MAX_LOGO_BYTES) {
		return {
			ok: false,
			reason: `logo exceeds maximum size of ${MAX_LOGO_BYTES} bytes`,
		};
	}

	let bytesToPersist = bytes;
	const sniff = sniffLogoContentType(bytesToPersist);
	if (!sniff.ok) {
		return { ok: false, reason: sniff.reason };
	}

	if (sniff.contentType === "image/svg+xml") {
		const sanitized = sanitizeSvgLogo(bytesToPersist);
		if (!sanitized.ok) {
			return { ok: false, reason: sanitized.errors.join("; ") };
		}
		bytesToPersist = Buffer.from(sanitized.sanitized);
	}

	const logoChecksum = computeLogoChecksum(bytesToPersist);
	const storageKey = buildLogoStorageKey(
		workspaceId,
		logoChecksum,
		sniff.contentType,
	);

	return {
		ok: true,
		logo: {
			bytes: bytesToPersist,
			logoChecksum,
			contentType: sniff.contentType,
			storageKey,
		},
	};
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
