import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IngestedLogo, WorkspaceTier } from "@usetagih/core";
import type { DocumentPayload } from "@usetagih/schema";
import { buildTypstInputArgs } from "./golden/render-fixture.js";
import { prepareIngestedLogoForTypst } from "./logo-ingestion/prepare-ingested-logo-for-typst.js";
import { resolveDocumentTemplatePath } from "./template-path.js";
import { mapWorkspaceTierToTypstTier } from "./tier-map.js";
import { compileTypst } from "./typst-driver.js";

export type RenderPdfFromPayloadInput = {
	payload: DocumentPayload;
	workspaceTier: WorkspaceTier;
	logo: IngestedLogo | null;
};

export type RenderPdfFromPayloadResult = {
	pdfBytes: Uint8Array;
	sha256: string;
	byteSize: number;
};

function sha256Buffer(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

export function renderPdfFromPayload(
	input: RenderPdfFromPayloadInput,
): RenderPdfFromPayloadResult {
	const { payload, workspaceTier, logo } = input;
	const templatePath = resolveDocumentTemplatePath(
		payload.documentType,
		payload.template,
	);
	const templateDir = dirname(templatePath);
	const sessionRoot = join(
		templateDir,
		".tmp",
		`render-payload-${randomUUID()}`,
	);
	const payloadPath = join(sessionRoot, "payload.json");
	const outputPath = join(sessionRoot, "output.pdf");

	mkdirSync(sessionRoot, { recursive: true });

	try {
		writeFileSync(payloadPath, JSON.stringify(payload));

		const typstTier = mapWorkspaceTierToTypstTier(workspaceTier);
		const inputs: Record<string, string> = { tier: typstTier };

		if (logo) {
			const logoPrep = prepareIngestedLogoForTypst(
				logo,
				templateDir,
				sessionRoot,
			);
			inputs.logo = logoPrep.logoInputArg.replace(/^logo=/, "");
		}

		const extraArgs = buildTypstInputArgs(templatePath, payloadPath, inputs);

		compileTypst({
			inputPath: templatePath,
			outputPath,
			extraArgs,
		});

		const pdfBytes = readFileSync(outputPath);
		const sha256 = sha256Buffer(pdfBytes);

		return {
			pdfBytes: new Uint8Array(pdfBytes),
			sha256,
			byteSize: pdfBytes.byteLength,
		};
	} finally {
		rmSync(sessionRoot, { recursive: true, force: true });
	}
}
