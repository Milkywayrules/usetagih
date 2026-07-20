import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { z } from "zod";
import type { DocumentType } from "../document/document-type";
import { checkDocumentTypeMismatch } from "../document/document-type-mismatch";
import type { DOCUMENT_TYPE_MISMATCH_CODE, ErrorCode } from "../errors/codes";
import { zodIssueToDetail } from "../errors/detail";
import type { ValidateDocumentPayloadResult } from "../validation/validate-document-payload";
import { validateDocumentPayload } from "../validation/validate-document-payload";

export type FixtureExpectedPass = { outcome: "pass" };

export type FixtureExpectedFailPayload = {
	outcome: "fail";
	stage: "schemaVersion" | "structural" | "business";
	expected: { path: string; code: ErrorCode };
};

export type FixtureExpectedFailDocumentTypeMismatch = {
	outcome: "fail";
	stage: "documentTypeMismatch";
	pathDocumentType: DocumentType;
	body: Record<string, unknown>;
	expected: { path: "/documentType"; code: typeof DOCUMENT_TYPE_MISMATCH_CODE };
};

export type FixtureExpectedOutcome =
	| FixtureExpectedPass
	| FixtureExpectedFailPayload
	| FixtureExpectedFailDocumentTypeMismatch;

export type FixturePair = {
	name: string;
	payloadPath: string | null;
	expectedPath: string;
	expected: FixtureExpectedOutcome;
	payload: unknown | null;
};

function isExpectedSidecar(fileName: string): boolean {
	return fileName.endsWith(".expected.json");
}

function payloadPathForExpected(expectedFilePath: string): string {
	return expectedFilePath.replace(/\.expected\.json$/, ".json");
}

function collectJsonFiles(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const absolutePath = join(dir, entry);
		const stats = statSync(absolutePath);
		if (stats.isDirectory()) {
			files.push(...collectJsonFiles(absolutePath));
			continue;
		}
		if (entry.endsWith(".json")) {
			files.push(absolutePath);
		}
	}

	return files;
}

function parseExpectedOutcome(expectedPath: string): FixtureExpectedOutcome {
	const raw = JSON.parse(
		readFileSync(expectedPath, "utf8"),
	) as FixtureExpectedOutcome;
	return raw;
}

export function discoverFixturePairs(fixturesRoot: string): FixturePair[] {
	const allJsonFiles = collectJsonFiles(fixturesRoot);
	const expectedFiles = allJsonFiles.filter((filePath) =>
		isExpectedSidecar(filePath),
	);
	const pairs: FixturePair[] = [];

	for (const expectedPath of expectedFiles) {
		const expected = parseExpectedOutcome(expectedPath);
		const relativeExpectedPath = relative(fixturesRoot, expectedPath);
		const name = relativeExpectedPath.replace(/\.expected\.json$/, "");

		if (
			expected.outcome === "fail" &&
			expected.stage === "documentTypeMismatch"
		) {
			pairs.push({
				name,
				payloadPath: null,
				expectedPath: relativeExpectedPath,
				expected,
				payload: null,
			});
			continue;
		}

		const payloadPath = payloadPathForExpected(expectedPath);
		if (!allJsonFiles.includes(payloadPath)) {
			throw new Error(
				`Missing payload JSON for expected sidecar: ${relativeExpectedPath}`,
			);
		}

		const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
		pairs.push({
			name,
			payloadPath: relative(fixturesRoot, payloadPath),
			expectedPath: relativeExpectedPath,
			expected,
			payload,
		});
	}

	const payloadFiles = allJsonFiles.filter(
		(filePath) => !isExpectedSidecar(filePath),
	);
	for (const payloadPath of payloadFiles) {
		const expectedPath = `${payloadPath.slice(0, -".json".length)}.expected.json`;
		if (!allJsonFiles.includes(expectedPath)) {
			throw new Error(
				`Missing expected sidecar for payload: ${relative(fixturesRoot, payloadPath)}`,
			);
		}
	}

	return pairs.sort((left, right) => left.name.localeCompare(right.name));
}

export { zodPathToJsonPointer } from "../errors/detail";

export function zodErrorToPrimaryJsonPointer(error: z.ZodError): {
	path: string;
	code: ReturnType<typeof zodIssueToDetail>["code"];
} {
	const primary = zodIssueToDetail(error.issues[0]);
	return { path: primary.path, code: primary.code };
}

export function extractPrimaryFinding(
	result: Exclude<ValidateDocumentPayloadResult, { ok: true }>,
): { path: string; code: ErrorCode } {
	if (result.stage === "schemaVersion") {
		return { path: "/schemaVersion", code: result.rejection.code };
	}

	if (result.stage === "structural") {
		return zodErrorToPrimaryJsonPointer(result.error);
	}

	const [firstFinding] = result.findings;
	return { path: firstFinding.path, code: firstFinding.code };
}

export function runFixtureExpectation(
	payload: unknown | null,
	expected: FixtureExpectedOutcome,
): void {
	if (expected.outcome === "pass") {
		const result = validateDocumentPayload(payload);
		if (!result.ok) {
			throw new Error(
				`Expected pass but got ${result.stage} failure: ${JSON.stringify(result)}`,
			);
		}
		return;
	}

	if (expected.stage === "documentTypeMismatch") {
		const mismatch = checkDocumentTypeMismatch(
			expected.pathDocumentType,
			expected.body,
		);
		if (mismatch.match) {
			throw new Error("Expected document type mismatch but got match");
		}
		if (mismatch.code !== expected.expected.code) {
			throw new Error(
				`Expected code ${expected.expected.code} but got ${mismatch.code}`,
			);
		}
		return;
	}

	const result = validateDocumentPayload(payload);
	if (result.ok) {
		throw new Error(`Expected ${expected.stage} failure but payload passed`);
	}

	const finding = extractPrimaryFinding(result);
	if (finding.path !== expected.expected.path) {
		throw new Error(
			`Expected path ${expected.expected.path} but got ${finding.path}`,
		);
	}
	if (finding.code !== expected.expected.code) {
		throw new Error(
			`Expected code ${expected.expected.code} but got ${finding.code}`,
		);
	}
}

export function loadAllExpectedOutcomes(
	fixturesRoot: string,
): FixtureExpectedOutcome[] {
	return discoverFixturePairs(fixturesRoot).map((pair) => pair.expected);
}
