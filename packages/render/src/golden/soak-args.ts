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

function parsePositiveInteger(value: string | undefined): number {
	if (!value || !/^\d+$/.test(value)) {
		throw new Error("invalid iterations");
	}

	const iterations = Number.parseInt(value, 10);
	if (!Number.isFinite(iterations) || iterations < 1) {
		throw new Error("invalid iterations");
	}

	return iterations;
}

function parseFixtureValue(value: string | undefined): string {
	if (!value || value.startsWith("--")) {
		throw new Error("invalid fixture");
	}

	return value;
}

export type SoakDriftReport = {
	fixtureId: string;
	iteration: number;
	firstHash: string;
	actualHash: string;
};

export function detectSoakHashDrift(
	fixtureId: string,
	iteration: number,
	firstHash: string | null,
	currentHash: string,
): SoakDriftReport | null {
	if (firstHash === null || currentHash === firstHash) {
		return null;
	}

	return { fixtureId, iteration, firstHash, actualHash: currentHash };
}

export function formatSoakDriftReport(drift: SoakDriftReport): string {
	return [
		`FAIL ${drift.fixtureId}`,
		`  drift at iteration ${drift.iteration}`,
		`  first hash: ${drift.firstHash}`,
		`  actual: ${drift.actualHash}`,
	].join("\n");
}

export function parseGoldenSoakArgs(argv: string[]): GoldenSoakArgs {
	let iterations = 5;
	const fixtureIds: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--iterations") {
			iterations = parsePositiveInteger(argv[i + 1]);
			i += 1;
		} else if (arg === "--fixture") {
			fixtureIds.push(parseFixtureValue(argv[i + 1]));
			i += 1;
		}
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
