import { randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { GoldenFixtureEntry } from "./golden/manifest";
import {
	buildTypstInputArgs,
	PACKAGE_ROOT,
	resolveTemplatePath,
} from "./golden/render-fixture";
import { sanitizeTypstOutputSvg } from "./svg-output-sanitize";
import { compileTypst, evalTypst } from "./typst-driver";

export type PreviewPage = { index: number; svg: string };
export type PreviewResult = { pageCount: number; pages: PreviewPage[] };

export type RenderPreviewOptions = {
	/** Absolute path to `.typ` template */
	templatePath: string;
	/** Absolute path to payload JSON */
	payloadPath: string;
	tier?: string;
	/** Typst `--input` map; defaults to `{ tier }` when omitted */
	inputs?: Record<string, string>;
};

const PAGE_SVG_PATTERN = /^page-(\d+)\.svg$/;

function getPdfPageCount(templatePath: string, extraArgs: string[]): number {
	const raw = evalTypst({
		inputPath: templatePath,
		expression: "query(<page-count>)",
		extraArgs,
	});
	const hits = JSON.parse(raw) as Array<{ value: number[] }>;
	const n = hits[0]?.value?.[0];
	if (n === undefined || !Number.isFinite(n)) {
		throw new Error(`failed to read <page-count> metadata: ${raw}`);
	}
	return Number(n);
}

function parsePreviewPages(previewTempDir: string): PreviewPage[] {
	const pages: PreviewPage[] = [];

	for (const filename of readdirSync(previewTempDir)) {
		const match = filename.match(PAGE_SVG_PATTERN);
		if (!match) {
			continue;
		}

		const index = Number.parseInt(match[1] ?? "", 10);
		if (!Number.isFinite(index)) {
			throw new Error(`invalid preview page filename: ${filename}`);
		}

		const raw = readFileSync(join(previewTempDir, filename), "utf8");
		const sanitized = sanitizeTypstOutputSvg(raw);
		if (!sanitized.ok) {
			throw new Error(
				`SVG sanitization failed for page ${index}: ${sanitized.errors.join(", ")}`,
			);
		}

		pages.push({
			index,
			svg: sanitized.sanitized.toString("utf8"),
		});
	}

	pages.sort((a, b) => a.index - b.index);
	return pages;
}

/** Compile same template+inputs as PDF; return sanitized multi-page SVG preview. */
export function renderPreview(options: RenderPreviewOptions): PreviewResult {
	const { templatePath, payloadPath, tier = "free", inputs } = options;
	const templateAbs = resolve(templatePath);
	const payloadAbs = resolve(payloadPath);

	if (!existsSync(templateAbs)) {
		throw new Error(`template not found: ${templateAbs}`);
	}
	if (!existsSync(payloadAbs)) {
		throw new Error(`payload not found: ${payloadAbs}`);
	}

	const typstInputs = inputs ?? { tier };
	const extraArgs = buildTypstInputArgs(templateAbs, payloadAbs, typstInputs);
	const previewTempDir = join(PACKAGE_ROOT, ".tmp", `preview-${randomUUID()}`);

	let pageCount = 0;
	let pages: PreviewPage[] = [];

	try {
		mkdirSync(previewTempDir, { recursive: true });

		compileTypst({
			inputPath: templateAbs,
			outputPath: join(previewTempDir, "page-{0p}.svg"),
			format: "svg",
			extraArgs,
		});

		pageCount = getPdfPageCount(templateAbs, extraArgs);
		pages = parsePreviewPages(previewTempDir);

		if (pages.length !== pageCount) {
			throw new Error(
				`SVG page count ${pages.length} !== PDF page count ${pageCount}`,
			);
		}
	} finally {
		rmSync(previewTempDir, { recursive: true, force: true });
	}

	return { pageCount, pages };
}

/** Manifest convenience wrapper mirroring golden render harness. */
export function renderPreviewFromManifest(
	entry: GoldenFixtureEntry,
	tier = "free",
): PreviewResult {
	const templateAbs = resolveTemplatePath(entry);
	const payloadAbs = resolve(PACKAGE_ROOT, entry.payload);
	const inputs = { ...entry.inputs, tier };

	return renderPreview({
		templatePath: templateAbs,
		payloadPath: payloadAbs,
		inputs,
	});
}
