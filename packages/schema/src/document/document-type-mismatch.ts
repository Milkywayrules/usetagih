import { DOCUMENT_TYPE_MISMATCH_CODE } from "../errors/codes";
import type { DocumentType } from "./document-type";
import { DocumentTypeSchema } from "./document-type";

export { DOCUMENT_TYPE_MISMATCH_CODE };

export type DocumentTypeMismatchResult =
	| { match: true }
	| {
			match: false;
			code: typeof DOCUMENT_TYPE_MISMATCH_CODE;
			message: string;
			pathDocumentType: DocumentType;
			bodyDocumentType: DocumentType;
	  };

function formatMismatchMessage(
	pathDocumentType: DocumentType,
	bodyDocumentType: string,
): string {
	return `documentType in body (${bodyDocumentType}) does not match path (${pathDocumentType})`;
}

export function checkDocumentTypeMismatch(
	pathDocumentType: DocumentType,
	body: { documentType?: unknown },
): DocumentTypeMismatchResult {
	if (body.documentType === undefined) {
		return { match: true };
	}

	const parsed = DocumentTypeSchema.safeParse(body.documentType);
	if (parsed.success && parsed.data === pathDocumentType) {
		return { match: true };
	}

	const bodyDocumentTypeLabel = parsed.success
		? parsed.data
		: String(body.documentType);

	return {
		match: false,
		code: DOCUMENT_TYPE_MISMATCH_CODE,
		message: formatMismatchMessage(pathDocumentType, bodyDocumentTypeLabel),
		pathDocumentType,
		bodyDocumentType: parsed.success
			? parsed.data
			: (bodyDocumentTypeLabel as DocumentType),
	};
}
