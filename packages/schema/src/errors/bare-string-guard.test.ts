import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_MISMATCH_CODE } from "../document/document-type-mismatch";
import {
	LINE_TOTAL_MISMATCH_CODE,
	TAX_TOTAL_MISMATCH_CODE,
	VALIDATION_FAILED_CODE,
} from "../validation/codes";
import type { BusinessRuleFinding } from "../validation/finding";
import { ERROR_CODES } from "./codes";

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, "..");

function readSource(relativePath: string): string {
	return readFileSync(join(srcRoot, relativePath), "utf8");
}

test("exported validation and document codes are members of ERROR_CODES", () => {
	const exportedCodes = [
		DOCUMENT_TYPE_MISMATCH_CODE,
		LINE_TOTAL_MISMATCH_CODE,
		TAX_TOTAL_MISMATCH_CODE,
		VALIDATION_FAILED_CODE,
	];

	for (const code of exportedCodes) {
		expect(ERROR_CODES).toContain(code);
	}
});

test("BusinessRuleFinding code narrows to ErrorCode", () => {
	const finding: BusinessRuleFinding = {
		path: "/totals/subtotal",
		code: VALIDATION_FAILED_CODE,
		message: "subtotal mismatch",
	};

	expect(ERROR_CODES).toContain(finding.code);
});

test("schema helper sources do not assign bare string error codes", () => {
	const sources = [
		"validation/validate-arithmetic.ts",
		"document/document-type-mismatch.ts",
		"validation/validate-document-payload.ts",
	];

	const bareStringAssignment = /code:\s*"/;

	for (const sourcePath of sources) {
		const source = readSource(sourcePath);
		const lines = source.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
				continue;
			}
			expect(bareStringAssignment.test(line)).toBe(false);
		}
	}
});

test("validation/codes.ts and document-type-mismatch.ts re-export from errors/codes", () => {
	expect(readSource("validation/codes.ts")).toContain('from "../errors/codes"');
	expect(readSource("document/document-type-mismatch.ts")).toContain(
		'from "../errors/codes"',
	);
});
