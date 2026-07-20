import { describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { createApp } from "../app.js";
import { initOtel } from "./otel.js";

describe("otel", () => {
	test("no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset", async () => {
		const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });
		const otel = initOtel(env);

		const app = otel.wrapApp(createApp({ env, otelEnabled: false }));
		const response = await app.handle(new Request("http://localhost/health"));
		expect(response.status).toBe(200);

		await expect(otel.shutdown()).resolves.toBeUndefined();
	});
});
