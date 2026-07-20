import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IngestedLogo, WorkspaceTier } from "@usetagih/core";
import type { DocumentPayload } from "@usetagih/schema";
import { prepareIngestedLogoForTypst } from "./logo-ingestion/prepare-ingested-logo-for-typst.js";
import { renderPreview } from "./preview.js";
import { buildPreviewHtml } from "./preview-html.js";
import { resolveDocumentTemplatePath } from "./template-path.js";
import { mapWorkspaceTierToTypstTier } from "./tier-map.js";

export type RenderPreviewFromPayloadInput = {
	payload: DocumentPayload;
	workspaceTier: WorkspaceTier;
	logo: IngestedLogo | null;
};

export type RenderPreviewFromPayloadResult = {
	pageCount: number;
	pages: Array<{ index: number; svg: string }>;
	html: string;
};

export function renderPreviewFromPayload(
	input: RenderPreviewFromPayloadInput,
): RenderPreviewFromPayloadResult {
	const { payload, workspaceTier, logo } = input;
	const templatePath = resolveDocumentTemplatePath(
		payload.documentType,
		payload.template,
	);
	const templateDir = dirname(templatePath);
	const sessionRoot = join(
		templateDir,
		".tmp",
		`preview-payload-${randomUUID()}`,
	);
	const payloadPath = join(sessionRoot, "payload.json");

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

		const previewTempDir = join(sessionRoot, "svg-pages");

		const preview = renderPreview({
			templatePath,
			payloadPath,
			inputs,
			previewTempDir,
		});

		return {
			pageCount: preview.pageCount,
			pages: preview.pages,
			html: buildPreviewHtml(preview.pages),
		};
	} finally {
		rmSync(sessionRoot, { recursive: true, force: true });
	}
}
