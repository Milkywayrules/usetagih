import { expect, test } from "bun:test";
import { sanitizeSvgLogo } from "./svg-sanitize";

const CLEAN_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#0D9488"/></svg>';

test("clean SVG passes sanitization", () => {
	const result = sanitizeSvgLogo(CLEAN_SVG);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).toBe(CLEAN_SVG);
		expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
	}
});

test("script tag inside svg is stripped and passes when no script remains", () => {
	const input = `<svg><script>alert(1)</script>${CLEAN_SVG.slice(5)}`;
	const result = sanitizeSvgLogo(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toContain("<script");
	}
});

test("self-closing script src is rejected when script tag remains", () => {
	const input = `<svg><script src="https://evil/x"/></svg>`;
	const result = sanitizeSvgLogo(input);
	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.errors.join("; ")).toMatch(/script/i);
	}
});

test("onload event handler is stripped and passes when no handlers remain", () => {
	const input = `<svg onload="alert(1)">${CLEAN_SVG.slice(5)}`;
	const result = sanitizeSvgLogo(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/\son[a-zA-Z]+\s*=/i);
	}
});

test("foreignObject is stripped and passes when tag removed", () => {
	const input = `<svg><foreignObject><div>html</div></foreignObject>${CLEAN_SVG.slice(5)}`;
	const result = sanitizeSvgLogo(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/<foreignObject/i);
	}
});

test("external xlink:href is stripped or rejected", () => {
	const input =
		'<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="https://evil.com/x.png"/></svg>';
	const result = sanitizeSvgLogo(input);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(
			/(?:xlink:)?href\s*=\s*["']?(?:https?:)?\/\//i,
		);
	} else {
		expect(result.errors.join("; ")).toMatch(/external href/i);
	}
});
