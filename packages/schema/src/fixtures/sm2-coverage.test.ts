import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllExpectedOutcomes } from "./runner";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(testDir, "../../__fixtures__");

const PAYLOAD_REACHABLE_CODES = [
	"VALIDATION_FAILED",
	"UNSUPPORTED_SCHEMA_VERSION",
	"DOCUMENT_TYPE_MISMATCH",
	"LINE_TOTAL_MISMATCH",
	"TAX_TOTAL_MISMATCH",
] as const;

test("SM-2 coverage: failure fixtures include path and code", () => {
	const allExpectedOutcomes = loadAllExpectedOutcomes(fixturesRoot);
	const failures = allExpectedOutcomes.filter(
		(entry) => entry.outcome === "fail",
	);
	const withPathCode = failures.filter(
		(entry) => entry.expected?.path && entry.expected?.code,
	);
	const ratio = withPathCode.length / failures.length;

	expect(ratio).toBeGreaterThanOrEqual(0.9);
	expect(ratio).toBe(1);
});

test("SM-2 coverage: every payload-reachable error code is exercised", () => {
	const allExpectedOutcomes = loadAllExpectedOutcomes(fixturesRoot);
	const failures = allExpectedOutcomes.filter(
		(entry) => entry.outcome === "fail",
	);
	const withPathCode = failures.filter(
		(entry) => entry.expected?.path && entry.expected?.code,
	);
	const codes = new Set(withPathCode.map((entry) => entry.expected.code));

	for (const code of PAYLOAD_REACHABLE_CODES) {
		expect(codes.has(code)).toBe(true);
	}
});
