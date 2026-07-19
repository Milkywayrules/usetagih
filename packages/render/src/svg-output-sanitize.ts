import { createHash } from "node:crypto";
import type { SvgSanitizeResult } from "./svg-sanitize";

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/>/gi;
const FOREIGN_OBJECT = /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi;
const ANIMATION_ELEMENT =
	/<(?:animate|set)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:animate|set)>)/gi;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const CDATA_BLOCK = /<!\[CDATA\[[\s\S]*?\]\]>/gi;
const EVENT_HANDLER =
	/\s(on[a-zA-Z]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]+)/gi;

const ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

const REJECT_SCRIPT = /<script/i;
const REJECT_FOREIGN_OBJECT = /<foreignObject/i;
const REJECT_ANIMATION = /<(?:animate|set)\b/i;
const REJECT_DANGEROUS_STYLE =
	/<style\b[^>]*>[\s\S]*?(?:@import|url\s*\(|javascript:|expression\s*\()/i;
const REJECT_EVENT_HANDLER = /\son[a-zA-Z]+\s*=/i;

function decodeNumericEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		);
}

function normalizeUrlProbe(value: string): string {
	return decodeNumericEntities(value).replace(/\s+/g, "").toLowerCase();
}

function isDangerousUrl(value: string): boolean {
	const normalized = normalizeUrlProbe(value);
	if (normalized.startsWith("#")) {
		return false;
	}
	return (
		/^(?:javascript|data|vbscript):/.test(normalized) ||
		/^(?:https?:)?\/\//.test(normalized) ||
		/^https?:/.test(normalized)
	);
}

function isDangerousStyle(value: string): boolean {
	const lower = decodeNumericEntities(value).toLowerCase();
	return (
		lower.includes("@import") ||
		lower.includes("url(") ||
		lower.includes("javascript:") ||
		lower.includes("expression(")
	);
}

function stripEventHandlers(svg: string): string {
	const decoded = decodeNumericEntities(svg);
	return decoded.replace(EVENT_HANDLER, "");
}

function stripDangerousStyleBlocks(svg: string): string {
	return svg.replace(STYLE_BLOCK, (block) => {
		const inner = block.replace(/<\/?style\b[^>]*>/gi, "");
		return isDangerousStyle(inner) ? "" : block;
	});
}

function stripScriptAndForeignObject(svg: string): string {
	return svg
		.replace(SCRIPT_BLOCK, "")
		.replace(FOREIGN_OBJECT, "")
		.replace(ANIMATION_ELEMENT, "")
		.replace(CDATA_BLOCK, "");
}

function stripExternalHrefAttributes(svg: string): string {
	return svg.replace(
		/<([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g,
		(full, name: string, attrs: string, selfClose: string) => {
			if (full.startsWith("</")) {
				return full;
			}

			const kept: string[] = [];
			for (const match of attrs.matchAll(ATTR)) {
				const rawName = match[1] ?? "";
				const nameLower = rawName.toLowerCase();
				const value = match[3] ?? match[4] ?? match[5] ?? "";

				if (nameLower.startsWith("on")) {
					continue;
				}
				if (nameLower === "href" || nameLower === "xlink:href") {
					if (isDangerousUrl(value)) {
						continue;
					}
				}
				if (nameLower === "style" && isDangerousStyle(value)) {
					continue;
				}

				const quote =
					match[3] !== undefined ? '"' : match[4] !== undefined ? "'" : "";
				if (quote) {
					kept.push(`${rawName}=${quote}${value}${quote}`);
				} else {
					kept.push(`${rawName}=${value}`);
				}
			}

			const cleanAttrs = kept.length > 0 ? ` ${kept.join(" ")}` : "";
			if (selfClose) {
				return `<${name}${cleanAttrs}/>`;
			}
			return `<${name}${cleanAttrs}>`;
		},
	);
}

function hasExternalHref(svg: string): boolean {
	for (const match of svg.matchAll(ATTR)) {
		const name = match[1]?.toLowerCase() ?? "";
		if (name !== "href" && name !== "xlink:href") {
			continue;
		}
		const value = match[3] ?? match[4] ?? match[5] ?? "";
		if (isDangerousUrl(value)) {
			return true;
		}
	}
	return false;
}

function collectErrors(svg: string): string[] {
	const errors: string[] = [];

	if (REJECT_SCRIPT.test(svg)) {
		errors.push("script tag remains after sanitization");
	}
	if (REJECT_FOREIGN_OBJECT.test(svg)) {
		errors.push("foreignObject tag remains after sanitization");
	}
	if (REJECT_ANIMATION.test(svg)) {
		errors.push("animation element remains after sanitization");
	}
	if (REJECT_DANGEROUS_STYLE.test(svg)) {
		errors.push("dangerous style block remains after sanitization");
	}
	if (REJECT_EVENT_HANDLER.test(decodeNumericEntities(svg))) {
		errors.push("event handler attribute remains after sanitization");
	}
	if (hasExternalHref(svg)) {
		errors.push("external or dangerous href remains after sanitization");
	}

	return errors;
}

/** Strip active content from Typst-emitted SVG while preserving structural elements. */
export function sanitizeTypstOutputSvg(
	input: Buffer | string,
): SvgSanitizeResult {
	let svg = typeof input === "string" ? input : input.toString("utf8");

	svg = stripScriptAndForeignObject(svg);
	svg = stripEventHandlers(svg);
	svg = stripExternalHrefAttributes(svg);
	svg = stripDangerousStyleBlocks(svg);

	const errors = collectErrors(svg);
	if (errors.length > 0) {
		return { ok: false, errors: [...new Set(errors)] };
	}

	const sanitized = Buffer.from(svg, "utf8");
	const sha256 = createHash("sha256").update(sanitized).digest("hex");
	return { ok: true, sanitized, sha256 };
}
