import { describe, expect, test } from "bun:test";
import {
	DOCUMENT_TYPE_PATHS,
	documentTypeToPathSegment,
	pathSegmentToDocumentType,
} from "./document-type-paths.js";

describe("document-type-paths", () => {
	test("pathSegmentToDocumentType maps plural segments to singular types", () => {
		expect(pathSegmentToDocumentType("invoices")).toBe("invoice");
		expect(pathSegmentToDocumentType("quotations")).toBe("quotation");
		expect(pathSegmentToDocumentType("receipts")).toBe("receipt");
	});

	test("pathSegmentToDocumentType returns null for unknown segments", () => {
		expect(pathSegmentToDocumentType("purchase-orders")).toBeNull();
		expect(pathSegmentToDocumentType("")).toBeNull();
	});

	test("documentTypeToPathSegment maps singular types to plural segments", () => {
		expect(documentTypeToPathSegment("invoice")).toBe("invoices");
		expect(documentTypeToPathSegment("quotation")).toBe("quotations");
		expect(documentTypeToPathSegment("receipt")).toBe("receipts");
	});

	test("DOCUMENT_TYPE_PATHS covers all supported segments", () => {
		expect(DOCUMENT_TYPE_PATHS).toEqual(["invoices", "quotations", "receipts"]);
		for (const segment of DOCUMENT_TYPE_PATHS) {
			expect(pathSegmentToDocumentType(segment)).not.toBeNull();
		}
	});
});
