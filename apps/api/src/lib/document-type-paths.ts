import type { DocumentType } from "@usetagih/schema";

export const DOCUMENT_TYPE_PATHS = [
	"invoices",
	"quotations",
	"receipts",
] as const;

export type DocumentTypePath = (typeof DOCUMENT_TYPE_PATHS)[number];

export const PATH_SEGMENT_TO_DOCUMENT_TYPE = {
	invoices: "invoice",
	quotations: "quotation",
	receipts: "receipt",
} as const satisfies Record<DocumentTypePath, DocumentType>;

const DOCUMENT_TYPE_TO_PATH_SEGMENT: Record<DocumentType, DocumentTypePath> = {
	invoice: "invoices",
	quotation: "quotations",
	receipt: "receipts",
};

export function pathSegmentToDocumentType(
	segment: string,
): DocumentType | null {
	return segment in PATH_SEGMENT_TO_DOCUMENT_TYPE
		? PATH_SEGMENT_TO_DOCUMENT_TYPE[
				segment as keyof typeof PATH_SEGMENT_TO_DOCUMENT_TYPE
			]
		: null;
}

export function documentTypeToPathSegment(
	documentType: DocumentType,
): DocumentTypePath {
	return DOCUMENT_TYPE_TO_PATH_SEGMENT[documentType];
}
