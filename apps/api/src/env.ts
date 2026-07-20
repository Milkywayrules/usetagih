import { type DopplerEnvironment, parseEnv } from "@usetagih/config/env";

export function parseApiEnv(
	raw: Record<string, string | undefined> = process.env,
) {
	const environment =
		(raw.DOPPLER_ENVIRONMENT as DopplerEnvironment | undefined) ?? "dev";
	return parseEnv(environment, raw);
}

export type ApiEnv = ReturnType<typeof parseApiEnv>;
