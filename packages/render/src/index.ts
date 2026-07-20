/** Placeholder render export — deprecated; Typst driver is primary. */
export const RENDER_STUB = "usetagih-render-stub" as const;

export {
	createMemoryLogoBlobStore,
	type FetchLogoResult,
	fetchLogoSsrfSafe,
	type IngestLogoResult,
	ingestLogoFromUrl,
	type MemoryLogoBlobStore,
	prepareIngestedLogoForTypst,
} from "./logo-ingestion/index.js";
export {
	type PreviewPage,
	type PreviewResult,
	type RenderPreviewOptions,
	renderPreview,
	renderPreviewFromManifest,
} from "./preview";
export {
	type RenderPreviewFromPayloadInput,
	type RenderPreviewFromPayloadResult,
	renderPreviewFromPayload,
} from "./preview-from-payload.js";
export { buildPreviewHtml } from "./preview-html.js";
export { sanitizeTypstOutputSvg } from "./svg-output-sanitize";
export {
	documentTemplateExists,
	resolveDocumentTemplatePath,
	TemplateNotFoundError,
} from "./template-path.js";
export {
	mapWorkspaceTierToTypstTier,
	type TypstTierInput,
} from "./tier-map.js";
export {
	type CompileTypstOptions,
	compileTypst,
	DEFAULT_SOURCE_DATE_EPOCH,
	type EvalTypstOptions,
	evalTypst,
	resolveFontPath,
	resolveTypstBinaryPath,
} from "./typst-driver";
