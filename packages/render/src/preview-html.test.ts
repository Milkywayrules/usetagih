import { expect, test } from "bun:test";
import { buildPreviewHtml } from "./preview-html.js";

test("buildPreviewHtml wraps pages in ascending index order", () => {
	const html = buildPreviewHtml([
		{ index: 2, svg: "<svg>two</svg>" },
		{ index: 1, svg: "<svg>one</svg>" },
	]);

	expect(html).toBe(
		'<div class="page" data-page="1"><svg>one</svg></div><div class="page" data-page="2"><svg>two</svg></div>',
	);
});
