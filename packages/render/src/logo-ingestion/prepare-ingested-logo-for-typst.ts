import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { IngestedLogo } from "@usetagih/core";

const CONTENT_EXT: Record<IngestedLogo["contentType"], string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/svg+xml": "svg",
};

export function prepareIngestedLogoForTypst(
	logo: IngestedLogo,
	templateDir: string,
	tmpRoot: string,
): { logoInputArg: string; logoChecksum: string } {
	const ext = CONTENT_EXT[logo.contentType];
	const logosDir = join(tmpRoot, "logos");
	mkdirSync(logosDir, { recursive: true });
	const logoAbs = join(logosDir, `${logo.logoChecksum}.${ext}`);
	writeFileSync(logoAbs, logo.bytes);

	const logoRel = relative(templateDir, logoAbs);
	return { logoInputArg: `logo=${logoRel}`, logoChecksum: logo.logoChecksum };
}
