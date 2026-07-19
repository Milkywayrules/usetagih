import { createHash } from "node:crypto";

export type SvgSanitizeResult =
	| { ok: true; sanitized: Buffer; sha256: string }
	| { ok: false; errors: string[] };

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const FOREIGN_OBJECT_BLOCK =
	/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi;
const EVENT_HANDLER = /\s(on[a-zA-Z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_HREF =
	/\s(?:xlink:)?href\s*=\s*("(?:https?:)?\/\/[^"]*"|'(?:https?:)?\/\/[^']*'|(?:https?:)?\/\/[^\s>]+|https?:\/\/[^\s>]+)/gi;

const REJECT_SCRIPT = /<script/i;
const REJECT_EVENT_HANDLER = /\son[a-zA-Z]+\s*=/i;
const REJECT_FOREIGN_OBJECT = /<foreignObject/i;
const REJECT_EXTERNAL_HREF =
	/\s(?:xlink:)?href\s*=\s*("(?:https?:)?\/\/[^"]*"|'(?:https?:)?\/\/[^']*'|(?:https?:)?\/\/[^\s>]+|https?:\/\/[^\s>]+)/i;

/** Sanitize persisted SVG logo bytes before Typst write. Pure TS — no DOM deps. */
export function sanitizeSvgLogo(input: Buffer | string): SvgSanitizeResult {
	let svg = typeof input === "string" ? input : input.toString("utf8");

	svg = svg.replace(SCRIPT_BLOCK, "");
	svg = svg.replace(FOREIGN_OBJECT_BLOCK, "");
	svg = svg.replace(EVENT_HANDLER, "");
	svg = svg.replace(EXTERNAL_HREF, "");

	const errors: string[] = [];
	if (REJECT_SCRIPT.test(svg)) {
		errors.push("script tag remains after sanitization");
	}
	if (REJECT_EVENT_HANDLER.test(svg)) {
		errors.push("event handler attribute remains after sanitization");
	}
	if (REJECT_FOREIGN_OBJECT.test(svg)) {
		errors.push("foreignObject tag remains after sanitization");
	}
	if (REJECT_EXTERNAL_HREF.test(svg)) {
		errors.push("external href remains after sanitization");
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	const sanitized = Buffer.from(svg, "utf8");
	const sha256 = createHash("sha256").update(sanitized).digest("hex");
	return { ok: true, sanitized, sha256 };
}
