import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDocumentTypeMismatch } from "../document/document-type-mismatch";
import { validateDocumentPayload } from "../validation/validate-document-payload";
import {
	discoverFixturePairs,
	extractPrimaryFinding,
	runFixtureExpectation,
} from "./runner";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(testDir, "../../__fixtures__");

const pairs = discoverFixturePairs(fixturesRoot);

test("fixture corpus has 3 valid and at least 20 failure entries", () => {
	const passEntries = pairs.filter((pair) => pair.expected.outcome === "pass");
	const failEntries = pairs.filter((pair) => pair.expected.outcome === "fail");

	expect(passEntries.length).toBe(3);
	expect(failEntries.length).toBeGreaterThanOrEqual(20);
	expect(failEntries.length).toBe(22);
});

test("every failure sidecar declares expected.path and expected.code", () => {
	for (const pair of pairs) {
		if (pair.expected.outcome !== "fail") {
			continue;
		}

		expect(pair.expected.expected?.path).toBeTruthy();
		expect(pair.expected.expected?.code).toBeTruthy();
	}
});

test("fixture suite matches declared pass/fail outcomes", () => {
	for (const pair of pairs) {
		const { expected, payload } = pair;

		if (expected.outcome === "pass") {
			const result = validateDocumentPayload(payload);
			expect(result.ok).toBe(true);
			continue;
		}

		if (expected.stage === "documentTypeMismatch") {
			const mismatch = checkDocumentTypeMismatch(
				expected.pathDocumentType,
				expected.body,
			);
			expect(mismatch.match).toBe(false);
			if (!mismatch.match) {
				expect({
					path: "/documentType",
					code: mismatch.code,
				}).toEqual(expected.expected);
			}
			continue;
		}

		const result = validateDocumentPayload(payload);
		expect(result.ok).toBe(false);
		if (result.ok) {
			continue;
		}

		expect(extractPrimaryFinding(result)).toEqual(expected.expected);
	}
});

test("runFixtureExpectation accepts every declared outcome", () => {
	for (const pair of pairs) {
		expect(() =>
			runFixtureExpectation(pair.payload, pair.expected),
		).not.toThrow();
	}
});
