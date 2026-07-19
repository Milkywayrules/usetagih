import { readFileSync } from "node:fs";

export type SpikeStatus = "PASS" | "FAIL";

export class SpikeGateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SpikeGateError";
	}
}

const STATUS_LINE = /^status:\s*(PASS|FAIL)\s*$/;

/** Parse first `status: PASS|FAIL` line (value case-sensitive). */
export function parseSpikeStatus(markdown: string): SpikeStatus {
	for (const line of markdown.split("\n")) {
		const match = line.match(STATUS_LINE);
		if (match) {
			return match[1] as SpikeStatus;
		}
	}

	throw new SpikeGateError(
		"missing or invalid status: line in SPIKE-RESULT.md",
	);
}

/** Read file; throw SpikeGateError if missing or unparseable. */
export function readSpikeResultStatus(spikeResultPath: string): SpikeStatus {
	let content: string;

	try {
		content = readFileSync(spikeResultPath, "utf8");
	} catch {
		throw new SpikeGateError(
			`could not read SPIKE-RESULT.md at ${spikeResultPath}`,
		);
	}

	return parseSpikeStatus(content);
}
