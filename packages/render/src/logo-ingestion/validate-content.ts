import type { LogoContentType } from "@usetagih/core";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export type ContentSniffResult =
	| { ok: true; contentType: LogoContentType; ext: "png" | "jpg" | "svg" }
	| { ok: false; reason: string };

function trimBomAndWhitespace(bytes: Buffer): Buffer {
	let start = 0;
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xef &&
		bytes[1] === 0xbb &&
		bytes[2] === 0xbf
	) {
		start = 3;
	}
	while (start < bytes.length) {
		const byte = bytes[start];
		if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
			start += 1;
			continue;
		}
		break;
	}
	return bytes.subarray(start);
}

function sniffSvg(bytes: Buffer): boolean {
	const trimmed = trimBomAndWhitespace(bytes);
	const head = trimmed
		.subarray(0, Math.min(trimmed.length, 1024))
		.toString("utf8");
	const lower = head.toLowerCase();
	if (lower.startsWith("<svg")) {
		return true;
	}
	if (lower.startsWith("<?xml")) {
		return lower.includes("<svg");
	}
	return false;
}

export function sniffLogoContentType(bytes: Buffer): ContentSniffResult {
	if (
		bytes.length >= PNG_MAGIC.length &&
		bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
	) {
		return { ok: true, contentType: "image/png", ext: "png" };
	}
	if (
		bytes.length >= JPEG_MAGIC.length &&
		bytes.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)
	) {
		return { ok: true, contentType: "image/jpeg", ext: "jpg" };
	}
	if (sniffSvg(bytes)) {
		return { ok: true, contentType: "image/svg+xml", ext: "svg" };
	}
	return {
		ok: false,
		reason: "logo bytes do not match allowed PNG, JPEG, or SVG magic bytes",
	};
}
