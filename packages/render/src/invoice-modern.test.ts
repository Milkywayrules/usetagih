import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
	compileTypst,
	evalTypst,
	resolveTypstBinaryPath,
} from "./typst-driver";

const PACKAGE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const FIXTURES_DIR = join(PACKAGE_ROOT, "__fixtures__");
const PAYLOADS_DIR = join(FIXTURES_DIR, "payloads");
const GOLDEN_DIR = join(FIXTURES_DIR, "golden");
const TMP_DIR = join(PACKAGE_ROOT, ".tmp");
const TEMPLATE_PATH = join(REPO_ROOT, "packages/templates/invoice/modern.typ");
const TEMPLATE_DIR = join(REPO_ROOT, "packages/templates/invoice");
const MANIFEST_PATH = join(PACKAGE_ROOT, "manifest.json");

const BASIC_FIXTURE = "invoice-modern-basic";
const PAGINATION_FIXTURE = "invoice-modern-pagination-25";
const WRONG_TOTAL_FIXTURE = "invoice-modern-wrong-total";
const FOOTER_TEXT = "Rendered with usetagih · usetagih.com";

const typstAvailable = existsSync(resolveTypstBinaryPath());
const renderTest = typstAvailable ? test : test.skip;

function payloadInputFor(fixture: string): string {
	const payloadPath = resolve(PAYLOADS_DIR, `${fixture}.json`);
	return relative(TEMPLATE_DIR, payloadPath);
}

function typstInputs(fixture: string, tier: string): string[] {
	return [
		"--input",
		`json=${payloadInputFor(fixture)}`,
		"--input",
		`tier=${tier}`,
	];
}

function sha256Buffer(data: Buffer): string {
	return createHash("sha256").update(data).digest("hex");
}

function sha256File(path: string): string {
	return sha256Buffer(readFileSync(path));
}

function renderFixture(
	fixture: string,
	tier: string,
	outputPath: string,
): Buffer {
	mkdirSync(TMP_DIR, { recursive: true });

	compileTypst({
		inputPath: TEMPLATE_PATH,
		outputPath,
		extraArgs: typstInputs(fixture, tier),
	});

	return readFileSync(outputPath);
}

function queryMetadata(fixture: string, tier: string, label: string): unknown {
	const raw = evalTypst({
		inputPath: TEMPLATE_PATH,
		expression: `query(<${label}>)`,
		extraArgs: typstInputs(fixture, tier),
	});

	return JSON.parse(raw) as unknown;
}

test("invoice-modern fixture and golden files exist", () => {
	expect(existsSync(join(PAYLOADS_DIR, `${BASIC_FIXTURE}.json`))).toBe(true);
	expect(existsSync(join(PAYLOADS_DIR, `${PAGINATION_FIXTURE}.json`))).toBe(
		true,
	);
	expect(existsSync(join(PAYLOADS_DIR, `${WRONG_TOTAL_FIXTURE}.json`))).toBe(
		true,
	);
	expect(existsSync(join(GOLDEN_DIR, `${BASIC_FIXTURE}.sha256`))).toBe(true);
	expect(existsSync(TEMPLATE_PATH)).toBe(true);
});

test("manifest includes invoice-modern-basic fixture entry", () => {
	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
		fixtures: Array<{
			id: string;
			sha256: string;
			typstVersion: string;
			schemaVersion: string;
			inputs: { tier: string };
		}>;
	};

	const entry = manifest.fixtures.find((f) => f.id === BASIC_FIXTURE);
	expect(entry).toBeDefined();
	expect(entry?.typstVersion).toBe("0.15.1");
	expect(entry?.schemaVersion).toBe("2026-07-20");
	expect(entry?.inputs.tier).toBe("free");
	expect(entry?.sha256).toMatch(/^[a-f0-9]{64}$/);

	const goldenHash = readFileSync(
		join(GOLDEN_DIR, `${BASIC_FIXTURE}.sha256`),
		"utf8",
	).trim();
	expect(entry?.sha256).toBe(goldenHash);
});

test("manifest includes invoice-modern-pagination-25 fixture entry", () => {
	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
		fixtures: Array<{
			id: string;
			sha256: string;
			typstVersion: string;
			schemaVersion: string;
			inputs: { tier: string };
		}>;
	};

	const entry = manifest.fixtures.find((f) => f.id === PAGINATION_FIXTURE);
	expect(entry).toBeDefined();
	expect(entry?.typstVersion).toBe("0.15.1");
	expect(entry?.schemaVersion).toBe("2026-07-20");
	expect(entry?.inputs.tier).toBe("free");
	expect(entry?.sha256).toMatch(/^[a-f0-9]{64}$/);

	const goldenHash = readFileSync(
		join(GOLDEN_DIR, `${PAGINATION_FIXTURE}.sha256`),
		"utf8",
	).trim();
	expect(entry?.sha256).toBe(goldenHash);
});

if (!typstAvailable) {
	test("typst binary missing — render tests skipped", () => {
		console.warn(
			`Skipping render tests: Typst binary not found at ${resolveTypstBinaryPath()}`,
		);
	});
}

renderTest("consecutive renders of basic fixture are byte-identical", () => {
	const out1 = join(TMP_DIR, `${BASIC_FIXTURE}-determinism-1.pdf`);
	const out2 = join(TMP_DIR, `${BASIC_FIXTURE}-determinism-2.pdf`);

	try {
		renderFixture(BASIC_FIXTURE, "free", out1);
		renderFixture(BASIC_FIXTURE, "free", out2);

		expect(sha256File(out1)).toBe(sha256File(out2));
	} finally {
		for (const file of [out1, out2]) {
			try {
				unlinkSync(file);
			} catch {
				// ignore cleanup errors
			}
		}
	}
});

renderTest("fresh render hash matches committed golden sha256", () => {
	const out = join(TMP_DIR, `${BASIC_FIXTURE}-golden-check.pdf`);
	const goldenPath = join(GOLDEN_DIR, `${BASIC_FIXTURE}.sha256`);

	try {
		renderFixture(BASIC_FIXTURE, "free", out);
		const hash = sha256File(out);
		const golden = readFileSync(goldenPath, "utf8").trim();

		expect(hash).toBe(golden);
	} finally {
		try {
			unlinkSync(out);
		} catch {
			// ignore cleanup errors
		}
	}
});

renderTest("tier=free exposes exact footer metadata in template", () => {
	const hits = queryMetadata(BASIC_FIXTURE, "free", "footer-text") as Array<{
		value: string;
	}>;

	expect(hits).toHaveLength(1);
	expect(hits[0]?.value).toBe(FOOTER_TEXT);
});

renderTest("tier=pro omits footer metadata from template", () => {
	const hits = queryMetadata(BASIC_FIXTURE, "pro", "footer-text") as unknown[];

	expect(hits).toHaveLength(0);
});

renderTest(
	"wrong-total fixture exposes grandTotal verbatim via metadata",
	() => {
		const basicHits = queryMetadata(
			BASIC_FIXTURE,
			"free",
			"grand-total",
		) as Array<{ value: string }>;
		const wrongHits = queryMetadata(
			WRONG_TOTAL_FIXTURE,
			"free",
			"grand-total",
		) as Array<{ value: string }>;

		expect(basicHits[0]?.value).toBe("673.56");
		expect(wrongHits[0]?.value).toBe("9999.99");
	},
);

renderTest(
	"pagination fixture spans multiple pages with totals on final page",
	() => {
		const pageCountHits = queryMetadata(
			PAGINATION_FIXTURE,
			"free",
			"page-count",
		) as Array<{ value: number }>;
		const totalsPageHits = queryMetadata(
			PAGINATION_FIXTURE,
			"free",
			"totals-page",
		) as Array<{ value: number }>;
		const grandHits = queryMetadata(
			PAGINATION_FIXTURE,
			"free",
			"grand-total",
		) as Array<{ value: string }>;

		expect(pageCountHits).toHaveLength(1);
		expect(totalsPageHits).toHaveLength(1);

		const pageCount = Number(pageCountHits[0]?.value);
		const totalsPage = Number(totalsPageHits[0]?.value);

		expect(pageCount).toBeGreaterThanOrEqual(2);
		// Totals may precede trailing notes on a later page; FR-8 requires no
		// clipped totals, not that notes cannot follow the totals block.
		expect(totalsPage).toBeGreaterThanOrEqual(1);
		expect(totalsPage).toBeLessThanOrEqual(pageCount);
		expect(grandHits[0]?.value).toBe("3836.38");
	},
);

renderTest("free and pro PDF hashes differ when footer toggles", () => {
	const outFree = join(TMP_DIR, `${BASIC_FIXTURE}-tier-free.pdf`);
	const outPro = join(TMP_DIR, `${BASIC_FIXTURE}-tier-pro.pdf`);

	try {
		renderFixture(BASIC_FIXTURE, "free", outFree);
		renderFixture(BASIC_FIXTURE, "pro", outPro);

		expect(sha256File(outFree)).not.toBe(sha256File(outPro));
	} finally {
		for (const file of [outFree, outPro]) {
			try {
				unlinkSync(file);
			} catch {
				// ignore cleanup errors
			}
		}
	}
});
