import { expect, test } from "bun:test";
import { sanitizeTypstOutputSvg } from "./svg-output-sanitize";

const WRAP = (inner: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

test("typst-clean: preserves use, symbol, and path", () => {
	const input = WRAP(
		'<defs><symbol id="x"><path d="M0 0"/></symbol></defs><use href="#x"/><path d="M1 1"/>',
	);
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		const out = result.sanitized.toString("utf8");
		expect(out).toContain("<use");
		expect(out).toContain("<symbol");
		expect(out).toContain("<path");
		expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
	}
});

test("injected-script: script stripped and passes when clean", () => {
	const input = WRAP(
		'<use href="#x"/><script>alert(1)</script><path d="M0 0"/>',
	);
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/<script/i);
	}
});

test("script-persist: obfuscated script tag rejects", () => {
	const input = WRAP("<scr<script>ipt>alert(1)</scr</script>ipt>");
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(false);
});

test("onload: event handler stripped and passes when clean", () => {
	const input = '<svg onload="alert(1)"><use href="#x"/></svg>';
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/\son[a-zA-Z]+\s*=/i);
	}
});

test("foreignObject: stripped and passes when tag removed", () => {
	const input = WRAP(
		'<foreignObject><div>html</div></foreignObject><use href="#x"/>',
	);
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/<foreignObject/i);
	}
});

test("external-href: external image ref stripped or rejected", () => {
	const input = WRAP('<image xlink:href="https://evil.com/x.png"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(
			/xlink:href\s*=\s*["']?https?:/i,
		);
	}
});

test("entity-encoded onload handler is stripped and passes when clean", () => {
	const input = WRAP('<rect &#111;nload="alert(1)" width="1" height="1"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/\sonload\s*=/i);
	}
});

test("internal-href: fragment ref preserved", () => {
	const input = WRAP('<use href="#glyph-0"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).toContain('href="#glyph-0"');
	}
});

test("javascript href is stripped and passes when clean", () => {
	const input = WRAP('<use href="javascript:alert(1)"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(
			/href\s*=\s*["']?javascript:/i,
		);
	}
});

test("href tab-obfuscated javascript: is stripped and passes when clean", () => {
	const input = WRAP('<a href="ja\tvascript:alert(1)"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(
			/(?:xlink:)?href\s*=\s*["']?(?:javascript|data:|https?:)/i,
		);
	}
});

test("CDATA script section is stripped and passes when clean", () => {
	const input =
		'<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[<script>alert(1)</script>]]></svg>';
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		const out = result.sanitized.toString("utf8");
		expect(out).not.toMatch(/<script/i);
		expect(out).not.toMatch(/<!\[CDATA\[/i);
	}
});

test("animate SMIL element is stripped and passes when clean", () => {
	const input = WRAP(
		'<animate attributeName="href" from="javascript:alert(1)" to="javascript:alert(2)"/>',
	);
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/<animate\b/i);
	}
});

test("style @import block is stripped and passes when clean", () => {
	const input = WRAP('<style>@import url("https://evil.com/x.css");</style>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		const out = result.sanitized.toString("utf8");
		expect(out).not.toMatch(/@import/i);
		expect(out).not.toMatch(/<style\b/i);
	}
});

test("onLoad mixed case handler is stripped and passes when clean", () => {
	const input = WRAP('<rect OnLoad="alert(1)" width="1" height="1"/>');
	const result = sanitizeTypstOutputSvg(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/\son[a-z]+\s*=/i);
	}
});

const rejectCases: Array<{ name: string; svg: string }> = [
	{
		name: "script tag survives strip",
		svg: WRAP("<scr<script>ipt>alert(1)</scr</script>ipt>"),
	},
];

for (const { name, svg } of rejectCases) {
	test(`rejects dirty SVG: ${name}`, () => {
		const result = sanitizeTypstOutputSvg(svg);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});
}
