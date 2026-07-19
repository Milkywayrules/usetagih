export const HEX_DIFF_BYTES = 32;

export type Sha256CompareResult = {
	match: boolean;
	expected: string;
	actual: string;
};

export type MismatchReportInput = {
	fixtureId: string;
	expectedManifest: string;
	expectedGoldenFile?: string;
	actual: string;
	render1Bytes: Buffer;
	render2Bytes?: Buffer;
	render2Hash?: string;
};

export type MismatchReport = {
	fixtureId: string;
	expectedManifest: string;
	expectedGoldenFile?: string;
	actual: string;
	pdfSize: number;
	secondRenderSize?: number;
	first32BytesRender1: string;
	first32BytesRender2?: string;
	flakeDetected: boolean;
};

function formatHex(buffer: Buffer, maxBytes = HEX_DIFF_BYTES): string {
	const slice = buffer.subarray(0, maxBytes);
	return [...slice].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function compareSha256(
	expected: string,
	actual: string,
): Sha256CompareResult {
	return {
		match: expected === actual,
		expected,
		actual,
	};
}

export function formatHexDiff(
	bytesA: Buffer,
	bytesB: Buffer,
	maxBytes = HEX_DIFF_BYTES,
): { a: string; b: string } {
	return {
		a: formatHex(bytesA, maxBytes),
		b: formatHex(bytesB, maxBytes),
	};
}

export function buildMismatchReport(
	input: MismatchReportInput,
): MismatchReport {
	const pdfSize = input.render1Bytes.length;
	const secondRenderSize = input.render2Bytes?.length;
	const flakeDetected =
		input.render2Hash !== undefined && input.render2Hash !== input.actual;

	return {
		fixtureId: input.fixtureId,
		expectedManifest: input.expectedManifest,
		expectedGoldenFile: input.expectedGoldenFile,
		actual: input.actual,
		pdfSize,
		secondRenderSize:
			secondRenderSize !== undefined && secondRenderSize !== pdfSize
				? secondRenderSize
				: undefined,
		first32BytesRender1: formatHex(input.render1Bytes),
		first32BytesRender2: input.render2Bytes
			? formatHex(input.render2Bytes)
			: undefined,
		flakeDetected,
	};
}

export function formatMismatchReport(report: MismatchReport): string {
	const lines = [
		`FAIL ${report.fixtureId}`,
		`  expected (manifest): ${report.expectedManifest}`,
	];

	if (
		report.expectedGoldenFile &&
		report.expectedGoldenFile !== report.expectedManifest
	) {
		lines.push(`  expected (golden file): ${report.expectedGoldenFile}`);
	}

	lines.push(`  actual: ${report.actual}`);
	lines.push(`  pdf size: ${report.pdfSize} bytes`);

	if (report.secondRenderSize !== undefined) {
		lines.push(
			`  second render size: ${report.secondRenderSize} bytes (flake suspected)`,
		);
	}

	lines.push(`  first 32 bytes (render 1): ${report.first32BytesRender1}`);

	if (report.first32BytesRender2) {
		lines.push(`  first 32 bytes (render 2): ${report.first32BytesRender2}`);
	}

	if (report.flakeDetected) {
		lines.push("  WARNING: consecutive renders differ — flake detected");
	}

	return lines.join("\n");
}

export function formatDriftReport(
	fixtureId: string,
	manifestHash: string,
	goldenFileHash: string,
): string {
	return [
		`FAIL ${fixtureId}`,
		"  MANIFEST/GOLDEN-FILE DRIFT",
		`  manifest sha256: ${manifestHash}`,
		`  golden file sha256: ${goldenFileHash}`,
	].join("\n");
}
