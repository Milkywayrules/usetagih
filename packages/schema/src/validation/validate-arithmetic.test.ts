import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentPayloadSchema } from "../document/document-payload";
import { quantitySchema } from "../document/primitives";
import { discoverFixturePairs } from "../fixtures/runner";
import { VALIDATION_FAILED_CODE } from "./codes";
import { validateDocumentPayloadArithmetic } from "./validate-arithmetic";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "../..");
const repoRoot = join(packageRoot, "../..");

function loadJson(relativePath: string): unknown {
	const absolutePath = join(packageRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function loadRepoJson(relativePath: string): unknown {
	const absolutePath = join(repoRoot, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

const validFixtures = [
	"__fixtures__/valid/invoice-minimal.json",
	"__fixtures__/valid/quotation-minimal.json",
	"__fixtures__/valid/receipt-minimal.json",
] as const;

test("valid minimal fixtures pass arithmetic validation", () => {
	for (const fixturePath of validFixtures) {
		const payload = DocumentPayloadSchema.parse(loadJson(fixturePath));
		expect(validateDocumentPayloadArithmetic(payload)).toEqual([]);
	}
});

test("invoice-modern-basic passes arithmetic validation", () => {
	const payload = DocumentPayloadSchema.parse(
		loadRepoJson(
			"packages/render/__fixtures__/payloads/invoice-modern-basic.json",
		),
	);
	expect(validateDocumentPayloadArithmetic(payload)).toEqual([]);
});

test("invoice-modern-pagination-25 passes arithmetic validation", () => {
	const payload = DocumentPayloadSchema.parse(
		loadRepoJson(
			"packages/render/__fixtures__/payloads/invoice-modern-pagination-25.json",
		),
	);
	expect(validateDocumentPayloadArithmetic(payload)).toEqual([]);
});

test("skips tax total check when taxLines is absent or empty", () => {
	const base = DocumentPayloadSchema.parse(
		loadJson("__fixtures__/valid/invoice-minimal.json"),
	);
	const wrongTaxTotal = "999.99";
	const adjustedGrandTotal = "1099.89";
	const withoutTaxLines = {
		...base,
		taxLines: undefined,
		totals: {
			...base.totals,
			taxTotal: { amount: wrongTaxTotal },
			grandTotal: { amount: adjustedGrandTotal },
		},
	};
	const findingsWithout = validateDocumentPayloadArithmetic(
		DocumentPayloadSchema.parse(withoutTaxLines),
	);
	expect(findingsWithout.filter((f) => f.path === "/totals/taxTotal")).toEqual(
		[],
	);

	const withEmptyTaxLines = {
		...base,
		taxLines: [],
		totals: {
			...base.totals,
			taxTotal: { amount: wrongTaxTotal },
			grandTotal: { amount: adjustedGrandTotal },
		},
	};
	const findingsEmpty = validateDocumentPayloadArithmetic(
		DocumentPayloadSchema.parse(withEmptyTaxLines),
	);
	expect(findingsEmpty.filter((f) => f.path === "/totals/taxTotal")).toEqual(
		[],
	);
});

test("invoice-modern-wrong-total fails grand total check", () => {
	const payload = DocumentPayloadSchema.parse(
		loadRepoJson(
			"packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json",
		),
	);
	const findings = validateDocumentPayloadArithmetic(payload);
	expect(findings).toContainEqual(
		expect.objectContaining({
			path: "/totals/grandTotal",
			code: VALIDATION_FAILED_CODE,
		}),
	);
});

const fixturesRoot = join(packageRoot, "__fixtures__");
const arithmeticFailureFixtures = discoverFixturePairs(fixturesRoot).filter(
	(pair) =>
		pair.expected.outcome === "fail" && pair.expected.stage === "business",
);

test("arithmetic failure fixtures emit expected path and code", () => {
	expect(arithmeticFailureFixtures.length).toBe(10);

	for (const fixture of arithmeticFailureFixtures) {
		if (
			fixture.expected.outcome !== "fail" ||
			fixture.expected.stage !== "business"
		) {
			continue;
		}

		const payload = DocumentPayloadSchema.parse(fixture.payload);
		const findings = validateDocumentPayloadArithmetic(payload);
		expect(findings.length).toBeGreaterThan(0);
		expect(findings).toContainEqual(
			expect.objectContaining({
				path: fixture.expected.expected.path,
				code: fixture.expected.expected.code,
			}),
		);
	}
});

test("quantitySchema rejects more than three fractional digits", () => {
	expect(() => quantitySchema.parse(1.2345)).toThrow();
});
