/** Placeholder render export — deprecated; Typst driver is primary. */
export const RENDER_STUB = "usetagih-render-stub" as const;

export {
	type CompileTypstOptions,
	compileTypst,
	DEFAULT_SOURCE_DATE_EPOCH,
	resolveFontPath,
	resolveTypstBinaryPath,
} from "./typst-driver";
