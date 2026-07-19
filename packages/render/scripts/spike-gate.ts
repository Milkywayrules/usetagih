import { resolve } from "node:path";
import { PACKAGE_ROOT } from "../src/golden/render-fixture";
import {
	readSpikeResultStatus,
	SpikeGateError,
} from "../src/golden/spike-gate";

const SPIKE_RESULT_PATH = resolve(PACKAGE_ROOT, "SPIKE-RESULT.md");

function main(): number {
	let status: "PASS" | "FAIL";

	try {
		status = readSpikeResultStatus(SPIKE_RESULT_PATH);
	} catch (error) {
		const message =
			error instanceof SpikeGateError
				? error.message
				: error instanceof Error
					? error.message
					: String(error);
		console.error(message);
		return 1;
	}

	if (status === "PASS") {
		console.log("SPIKE GATE: PASS — Epics 2+ unblocked");
		return 0;
	}

	console.error(
		"SPIKE GATE: FAIL — halt Epics 2–8; reopen PDF engine decision at board; no Chromium fallback\nSee packages/render/SPIKE-RESULT.md",
	);
	return 1;
}

process.exit(main());
