import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { computeLogoChecksum } from "./render-record";
import { sanitizeSvgLogo } from "./svg-sanitize";

export type PersistedLogoBytes = {
	contentType: "image/png" | "image/jpeg" | "image/svg+xml";
	bytesBase64: string;
};

const CONTENT_EXT: Record<PersistedLogoBytes["contentType"], string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/svg+xml": "svg",
};

export function prepareLogoForTypst(
	payloadAbsPath: string,
	templateDir: string,
): { logoInputArg?: string; logoChecksum?: string } {
	const payload = JSON.parse(readFileSync(payloadAbsPath, "utf8")) as {
		branding?: { logoBytes?: PersistedLogoBytes };
	};
	const logoBytes = payload?.branding?.logoBytes;
	if (!logoBytes?.bytesBase64 || !logoBytes?.contentType) {
		return {};
	}

	let bytes = Buffer.from(logoBytes.bytesBase64, "base64");
	if (logoBytes.contentType === "image/svg+xml") {
		const result = sanitizeSvgLogo(bytes);
		if (!result.ok) {
			throw new Error(`SVG logo rejected: ${result.errors.join("; ")}`);
		}
		bytes = Buffer.from(result.sanitized);
	}

	const checksum = computeLogoChecksum(bytes);
	const ext = CONTENT_EXT[logoBytes.contentType];
	const logosDir = join(dirname(payloadAbsPath), "../../.tmp/logos");
	mkdirSync(logosDir, { recursive: true });
	const logoAbs = join(logosDir, `${checksum}.${ext}`);
	writeFileSync(logoAbs, bytes);

	const logoRel = relative(templateDir, logoAbs);
	return { logoInputArg: `logo=${logoRel}`, logoChecksum: checksum };
}
