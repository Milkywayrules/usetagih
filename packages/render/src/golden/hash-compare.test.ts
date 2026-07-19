import { expect, test } from "bun:test";
import {
	buildMismatchReport,
	compareSha256,
	formatHexDiff,
	formatMismatchReport,
} from "./hash-compare";

const HASH_A =
	"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c";
const HASH_B =
	"b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105d";

test("compareSha256 returns match for identical hashes", () => {
	const result = compareSha256(HASH_A, HASH_A);
	expect(result.match).toBe(true);
	expect(result.expected).toBe(HASH_A);
	expect(result.actual).toBe(HASH_A);
});

test("compareSha256 returns mismatch for different hashes", () => {
	const result = compareSha256(HASH_A, HASH_B);
	expect(result.match).toBe(false);
	expect(result.expected).toBe(HASH_A);
	expect(result.actual).toBe(HASH_B);
});

test("formatHexDiff produces expected hex strings", () => {
	const a = Buffer.from([0x25, 0x50, 0x44, 0x46]);
	const b = Buffer.from([0x25, 0x50, 0x44, 0x47]);
	const diff = formatHexDiff(a, b, 4);
	expect(diff.a).toBe("25504446");
	expect(diff.b).toBe("25504447");
});

test("buildMismatchReport includes required fields", () => {
	const render1 = Buffer.alloc(100, 0x25);
	const render2 = Buffer.alloc(101, 0x26);
	const report = buildMismatchReport({
		fixtureId: "invoice-modern-basic",
		expectedManifest: HASH_A,
		actual: HASH_B,
		render1Bytes: render1,
		render2Bytes: render2,
		render2Hash: "different-hash",
	});

	expect(report.fixtureId).toBe("invoice-modern-basic");
	expect(report.expectedManifest).toBe(HASH_A);
	expect(report.actual).toBe(HASH_B);
	expect(report.pdfSize).toBe(100);
	expect(report.secondRenderSize).toBe(101);
	expect(report.first32BytesRender1.length).toBeGreaterThan(0);
	expect(report.flakeDetected).toBe(true);

	const formatted = formatMismatchReport(report);
	expect(formatted).toContain("FAIL invoice-modern-basic");
	expect(formatted).toContain(`expected (manifest): ${HASH_A}`);
	expect(formatted).toContain(`actual: ${HASH_B}`);
	expect(formatted).toContain("pdf size: 100 bytes");
	expect(formatted).toContain("second render size: 101 bytes");
	expect(formatted).toContain("first 32 bytes (render 1):");
	expect(formatted).toContain("WARNING: consecutive renders differ");
});
