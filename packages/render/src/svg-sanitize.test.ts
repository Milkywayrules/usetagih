import { expect, test } from "bun:test";
import { sanitizeSvgLogo } from "./svg-sanitize";

const CLEAN_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#0D9488"/></svg>';

const WRAP = (inner: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

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

test("self-closing script src is stripped when tag is removed", () => {
	const input = `<svg><script src="https://evil/x"/></svg>`;
	const result = sanitizeSvgLogo(input);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(/<script/i);
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
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.sanitized.toString("utf8")).not.toMatch(
			/(?:xlink:)?href\s*=/i,
		);
	}
});

const adversarialCases: Array<{
	name: string;
	svg: string;
	expectOk: boolean;
	forbidden?: RegExp;
}> = [
	{
		name: "mixed-case script tag",
		svg: WRAP("<ScRiPt>alert(1)</ScRiPt>"),
		expectOk: true,
		forbidden: /<script/i,
	},
	{
		name: "onload with newline before =",
		svg: '<svg xmlns="http://www.w3.org/2000/svg"\nonload\n=\n"alert(1)"></svg>',
		expectOk: true,
		forbidden: /\son[a-z]+\s*=/i,
	},
	{
		name: "onclick with internal whitespace",
		svg: WRAP('<rect onclick = "alert(1)" width="1" height="1"/>'),
		expectOk: true,
		forbidden: /\son[a-z]+\s*=/i,
	},
	{
		name: 'xlink:href = "javascript:alert(1)"',
		svg: WRAP('<use xlink:href = "javascript:alert(1)"/>'),
		expectOk: true,
		forbidden: /(?:xlink:)?href\s*=/i,
	},
	{
		name: "href tab-obfuscated javascript:",
		svg: WRAP('<a href="ja\tvascript:alert(1)"/>'),
		expectOk: true,
		forbidden: /(?:xlink:)?href\s*=/i,
	},
	{
		name: "href newline-obfuscated javascript:",
		svg: WRAP('<a href="ja\nvascript:alert(1)"/>'),
		expectOk: true,
		forbidden: /(?:xlink:)?href\s*=/i,
	},
	{
		name: "entity-encoded onload handler",
		svg: WRAP('<rect &#111;nload="alert(1)" width="1" height="1"/>'),
		expectOk: true,
		forbidden: /\sonload\s*=/i,
	},
	{
		name: "nested script tag scr<script>ipt",
		svg: WRAP("<scr<script>ipt>alert(1)</scr</script>ipt>"),
		expectOk: true,
		forbidden: /<script/i,
	},
	{
		name: 'use href="data:text/html,<script>alert(1)</script>"',
		svg: WRAP(
			'<use href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"/>',
		),
		expectOk: true,
		forbidden: /(?:xlink:)?href\s*=/i,
	},
	{
		name: 'image href="http://evil.com/x.png"',
		svg: WRAP('<image href="http://evil.com/x.png"/>'),
		expectOk: true,
		forbidden: /(?:xlink:)?href\s*=/i,
	},
	{
		name: "CDATA script section",
		svg: '<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[<script>alert(1)</script>]]></svg>',
		expectOk: true,
		forbidden: /<script/i,
	},
	{
		name: 'animate attributeName="href" with javascript:',
		svg: WRAP(
			'<animate attributeName="href" from="javascript:alert(1)" to="javascript:alert(2)"/>',
		),
		expectOk: true,
		forbidden: /<animate\b/i,
	},
	{
		name: "style @import external",
		svg: WRAP('<style>@import url("https://evil.com/x.css");</style>'),
		expectOk: true,
		forbidden: /<style\b|@import/i,
	},
	{
		name: "foreignObject mixed case",
		svg: WRAP("<FoReIgNoBjEcT><div>x</div></FoReIgNoBjEcT>"),
		expectOk: true,
		forbidden: /<foreignobject/i,
	},
	{
		name: "self-closing script mixed case",
		svg: WRAP('<ScRiPt src="https://evil/x"/>'),
		expectOk: true,
		forbidden: /<script/i,
	},
	{
		name: "onLoad mixed case handler",
		svg: WRAP('<rect OnLoad="alert(1)" width="1" height="1"/>'),
		expectOk: true,
		forbidden: /\son[a-z]+\s*=/i,
	},
];

for (const { name, svg, expectOk, forbidden } of adversarialCases) {
	test(`adversarial: ${name}`, () => {
		const result = sanitizeSvgLogo(svg);
		expect(result.ok).toBe(expectOk);
		if (result.ok) {
			const out = result.sanitized.toString("utf8");
			if (forbidden) {
				expect(out).not.toMatch(forbidden);
			}
			expect(out).not.toMatch(
				/<(?:script|foreignobject|animate|set|use|image|a|style)\b/i,
			);
			expect(out).not.toMatch(/\son[a-z]+\s*=/i);
			expect(out).not.toMatch(
				/(?:xlink:)?href\s*=\s*["']?(?:javascript|data:|https?:)/i,
			);
		}
	});
}
