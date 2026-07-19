import type { GoldenFixtureEntry, GoldenManifest } from "./manifest";

export type GoldenSoakArgs = {
	iterations: number;
	fixtureIds: string[];
};

export const GOLDEN_SOAK_USAGE =
	"Usage: bun scripts/golden-soak.ts [--iterations N] [--fixture <id>]...\n\nOptions:\n  --iterations N   Consecutive renders per fixture (default: 5)\n  --fixture <id>   Limit to manifest fixture id; repeat for multiple (default: all fixtures)";

export class UnknownFixtureError extends Error {
	constructor(
		public readonly unknownId: string,
		public readonly validIds: string[],
	) {
		super(`unknown fixture: ${unknownId}`);
		this.name = "UnknownFixtureError";
	}
}

export function parseGoldenSoakArgs(argv: string[]): GoldenSoakArgs {
	let iterations = 5;
	const fixtureIds: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--iterations" && argv[i + 1]) {
			iterations = Number.parseInt(argv[++i] ?? "5", 10);
		} else if (arg === "--fixture" && argv[i + 1]) {
			fixtureIds.push(argv[++i] ?? "");
		}
	}

	if (!Number.isFinite(iterations) || iterations < 1) {
		throw new Error("invalid iterations");
	}

	return { iterations, fixtureIds };
}

export function resolveSoakEntries(
	manifest: GoldenManifest,
	fixtureIds: string[],
): GoldenFixtureEntry[] {
	if (fixtureIds.length === 0) {
		return manifest.fixtures;
	}

	const validIds = manifest.fixtures.map((entry) => entry.id);
	const seen = new Set<string>();
	const entries: GoldenFixtureEntry[] = [];

	for (const id of fixtureIds) {
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);

		const entry = manifest.fixtures.find((fixture) => fixture.id === id);
		if (!entry) {
			throw new UnknownFixtureError(id, validIds);
		}
		entries.push(entry);
	}

	return entries;
}
