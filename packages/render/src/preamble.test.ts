import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const PREAMBLE_PATH = join(
	REPO_ROOT,
	"packages/templates/_shared/preamble.typ",
);

test("preamble.typ exists and encodes determinism directives", () => {
	expect(existsSync(PREAMBLE_PATH)).toBe(true);

	const content = readFileSync(PREAMBLE_PATH, "utf8");

	expect(content).toContain("#set document(date: none)");
	expect(content).toContain('"Inter"');
	expect(content).toContain('"JetBrains Mono"');
	expect(content).not.toContain("#datetime.today");
	expect(content).not.toContain("sys.version");
});
