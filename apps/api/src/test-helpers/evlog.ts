import { initLogger } from "evlog";

let initialized = false;

/** Single init for bun tests — quiet output, no pretty-print overhead. */
export function initTestLogger() {
	if (initialized) {
		return;
	}
	initLogger({
		env: { service: "usetagih-api-test" },
		pretty: false,
	});
	initialized = true;
}
