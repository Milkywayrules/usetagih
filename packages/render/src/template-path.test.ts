import { expect, test } from "bun:test";
import {
	documentTemplateExists,
	resolveDocumentTemplatePath,
	TemplateNotFoundError,
} from "./template-path.js";

test("documentTemplateExists is true for shipped invoice modern template", () => {
	expect(documentTemplateExists("invoice", "modern")).toBe(true);
});

test("documentTemplateExists is false for missing quotation template", () => {
	expect(documentTemplateExists("quotation", "modern")).toBe(false);
});

test("resolveDocumentTemplatePath throws TemplateNotFoundError when missing", () => {
	expect(() => resolveDocumentTemplatePath("receipt", "modern")).toThrow(
		TemplateNotFoundError,
	);
});
