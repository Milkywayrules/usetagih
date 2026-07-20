/** Placeholder render export — deprecated; Typst driver is primary. */
export const RENDER_STUB = "usetagih-render-stub" as const;

export {
	createMemoryLogoBlobStore,
	type FetchLogoResult,
	fetchLogoSsrfSafe,
	type IngestLogoResult,
	ingestLogoFromUrl,
	prepareIngestedLogoForTypst,
} from "./logo-ingestion/index.js";
export {
	type PreviewPage,
	type PreviewResult,
	type RenderPreviewOptions,
	renderPreview,
	renderPreviewFromManifest,
} from "./preview";
export { sanitizeTypstOutputSvg } from "./svg-output-sanitize";
export {
	type CompileTypstOptions,
	compileTypst,
	DEFAULT_SOURCE_DATE_EPOCH,
	type EvalTypstOptions,
	evalTypst,
	resolveFontPath,
	resolveTypstBinaryPath,
} from "./typst-driver";
