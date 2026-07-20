import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareIngestedLogoForTypst } from "./prepare-ingested-logo-for-typst.js";

test("writes ingested logo bytes for typst --input logo=", () => {
	const tmpRoot = mkdtempSync(join(tmpdir(), "usetagih-logo-"));
	const templateDir = join(tmpRoot, "template");
	try {
		const result = prepareIngestedLogoForTypst(
			{
				bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
				logoChecksum: "checksum123",
				contentType: "image/png",
				storageKey: "logos/ws-1/checksum123.png",
			},
			templateDir,
			tmpRoot,
		);

		expect(result.logoInputArg.startsWith("logo=")).toBe(true);
		expect(result.logoChecksum).toBe("checksum123");
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
});
