import { createHash } from "node:crypto";

export type SvgSanitizeResult =
	| { ok: true; sanitized: Buffer; sha256: string }
	| { ok: false; errors: string[] };

/** Elements permitted in persisted logo SVG — presentation shapes only. */
const ALLOWED_ELEMENTS = new Set([
	"svg",
	"g",
	"defs",
	"clippath",
	"mask",
	"lineargradient",
	"radialgradient",
	"stop",
	"path",
	"rect",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"text",
	"tspan",
	"title",
	"desc",
]);

/** Attributes permitted on allowed elements (lowercase). href/xlink:href excluded — logos are self-contained. */
const ALLOWED_ATTRIBUTES = new Set([
	"xmlns",
	"width",
	"height",
	"viewbox",
	"preserveaspectratio",
	"x",
	"y",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"d",
	"points",
	"fill",
	"stroke",
	"stroke-width",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-opacity",
	"fill-opacity",
	"opacity",
	"transform",
	"clip-path",
	"mask",
	"gradientunits",
	"spreadmethod",
	"offset",
	"stop-color",
	"stop-opacity",
	"font-family",
	"font-size",
	"font-weight",
	"text-anchor",
	"dominant-baseline",
	"id",
	"class",
	"style",
	"fill-rule",
	"clip-rule",
]);

const BLOCKED_ELEMENT =
	/<(?:script|foreignobject|animate|set|use|image|a|style|link|iframe|object|embed)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:script|foreignobject|animate|set|use|image|a|style|link|iframe|object|embed)>)/gi;
const CDATA_BLOCK = /<!\[CDATA\[[\s\S]*?\]\]>/gi;

const TAG = /<\/?([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
const ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

const REJECT_SCRIPT = /<script/i;
const REJECT_FOREIGN_OBJECT = /<foreignObject/i;
const REJECT_BLOCKED_ELEMENT =
	/<(?:script|foreignobject|animate|set|use|image|a|style|link|iframe|object|embed)\b/i;
const REJECT_EVENT_HANDLER = /\son[a-z]+\s*=/i;
const REJECT_HREF = /\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;
const REJECT_DISALLOWED_ELEMENT = /<\/?([a-zA-Z][\w:-]*)/g;

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

function hasEventHandler(attrs: string): boolean {
	return REJECT_EVENT_HANDLER.test(decodeNumericEntities(attrs));
}

function hasExternalHref(attrs: string): boolean {
	for (const match of attrs.matchAll(ATTR)) {
		const name = match[1]?.toLowerCase() ?? "";
		if (name !== "href" && name !== "xlink:href") {
			continue;
		}
		const value = match[3] ?? match[4] ?? match[5] ?? "";
		if (isDangerousUrl(value)) {
			return true;
		}
	}
	return REJECT_HREF.test(attrs) && isDangerousUrl(attrs);
}

function sanitizeAttributes(attrs: string): string {
	const kept: string[] = [];
	for (const match of attrs.matchAll(ATTR)) {
		const rawName = match[1] ?? "";
		const name = rawName.toLowerCase();
		const value = match[3] ?? match[4] ?? match[5] ?? "";

		if (name.startsWith("on") || hasEventHandler(` ${rawName}="${value}"`)) {
			continue;
		}
		if (name === "href" || name === "xlink:href") {
			continue;
		}
		if (!ALLOWED_ATTRIBUTES.has(name)) {
			continue;
		}
		if (name === "style" && isDangerousStyle(value)) {
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
	return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

function sanitizeTags(svg: string): string {
	return svg.replace(
		TAG,
		(full, name: string, attrs: string, selfClose: string) => {
			const closing = full.startsWith("</");
			const nameLower = name.toLowerCase();

			if (closing) {
				return ALLOWED_ELEMENTS.has(nameLower) ? `</${name}>` : "";
			}

			if (!ALLOWED_ELEMENTS.has(nameLower)) {
				return "";
			}

			const cleanAttrs = sanitizeAttributes(attrs);
			if (selfClose) {
				return `<${name}${cleanAttrs}/>`;
			}
			return `<${name}${cleanAttrs}>`;
		},
	);
}

function collectErrors(svg: string): string[] {
	const errors: string[] = [];

	if (REJECT_SCRIPT.test(svg)) {
		errors.push("script tag remains after sanitization");
	}
	if (REJECT_FOREIGN_OBJECT.test(svg)) {
		errors.push("foreignObject tag remains after sanitization");
	}
	if (REJECT_BLOCKED_ELEMENT.test(svg)) {
		errors.push(
			"active or external-content element remains after sanitization",
		);
	}
	if (hasEventHandler(svg)) {
		errors.push("event handler attribute remains after sanitization");
	}
	if (hasExternalHref(svg)) {
		errors.push("external or dangerous href remains after sanitization");
	}

	for (const match of svg.matchAll(REJECT_DISALLOWED_ELEMENT)) {
		const name = match[1]?.toLowerCase() ?? "";
		if (!ALLOWED_ELEMENTS.has(name)) {
			errors.push("disallowed element remains after sanitization");
			break;
		}
	}

	return errors;
}

/** Sanitize persisted SVG logo bytes before Typst write. Pure TS — no DOM deps. */
export function sanitizeSvgLogo(input: Buffer | string): SvgSanitizeResult {
	let svg = typeof input === "string" ? input : input.toString("utf8");

	svg = svg.replace(BLOCKED_ELEMENT, "");
	svg = svg.replace(CDATA_BLOCK, "");
	svg = sanitizeTags(svg);

	const errors = collectErrors(svg);
	if (errors.length > 0) {
		return { ok: false, errors: [...new Set(errors)] };
	}

	const sanitized = Buffer.from(svg, "utf8");
	const sha256 = createHash("sha256").update(sanitized).digest("hex");
	return { ok: true, sanitized, sha256 };
}
