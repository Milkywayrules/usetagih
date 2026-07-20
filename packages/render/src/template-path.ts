import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DocumentType } from "@usetagih/schema";
import { PACKAGE_ROOT } from "./golden/render-fixture.js";

const REPO_TEMPLATES_ROOT = resolve(PACKAGE_ROOT, "../templates");

export class TemplateNotFoundError extends Error {
	readonly documentType: DocumentType;
	readonly template: string;

	constructor(documentType: DocumentType, template: string) {
		super(`template not found: ${documentType}/${template}`);
		this.name = "TemplateNotFoundError";
		this.documentType = documentType;
		this.template = template;
	}
}

export function documentTemplateExists(
	documentType: DocumentType,
	template: string,
): boolean {
	const path = join(REPO_TEMPLATES_ROOT, documentType, `${template}.typ`);
	return existsSync(path);
}

export function resolveDocumentTemplatePath(
	documentType: DocumentType,
	template: string,
): string {
	const path = join(REPO_TEMPLATES_ROOT, documentType, `${template}.typ`);
	if (!existsSync(path)) {
		throw new TemplateNotFoundError(documentType, template);
	}
	return path;
}
