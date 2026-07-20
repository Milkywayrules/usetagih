import type { PreviewPage } from "./preview.js";

export function buildPreviewHtml(pages: PreviewPage[]): string {
	return pages
		.slice()
		.sort((a, b) => a.index - b.index)
		.map(
			(page) => `<div class="page" data-page="${page.index}">${page.svg}</div>`,
		)
		.join("");
}
