import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	parseSpikeStatus,
	readSpikeResultStatus,
	SpikeGateError,
} from "./spike-gate";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function writeTempSpike(content: string): string {
	const dir = mkdtempSync(join(tmpdir(), "spike-gate-"));
	tempDirs.push(dir);
	const path = join(dir, "SPIKE-RESULT.md");
	writeFileSync(path, content, "utf8");
	return path;
}

test("parseSpikeStatus returns PASS for status: PASS line", () => {
	const markdown = "# title\n\nstatus: PASS\n\n## Verdict";
	expect(parseSpikeStatus(markdown)).toBe("PASS");
});

test("parseSpikeStatus returns FAIL for status: FAIL line", () => {
	expect(parseSpikeStatus("status: FAIL")).toBe("FAIL");
});

test("parseSpikeStatus rejects lowercase pass", () => {
	expect(() => parseSpikeStatus("status: pass")).toThrow(SpikeGateError);
});

test("parseSpikeStatus throws when status line is missing", () => {
	expect(() => parseSpikeStatus("# no status")).toThrow(SpikeGateError);
});

test("parseSpikeStatus trims trailing whitespace on value", () => {
	expect(parseSpikeStatus("status: PASS  ")).toBe("PASS");
});

test("readSpikeResultStatus reads PASS from temp file", () => {
	const path = writeTempSpike("# title\n\nstatus: PASS\n");
	expect(readSpikeResultStatus(path)).toBe("PASS");
});

test("readSpikeResultStatus throws for missing file", () => {
	expect(() => readSpikeResultStatus("/nonexistent/SPIKE-RESULT.md")).toThrow(
		SpikeGateError,
	);
});
