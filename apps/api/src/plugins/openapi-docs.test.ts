import { describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { createApp } from "../app.js";

function docsEnv(enabled: boolean) {
	return parseEnv("dev", {
		USETAGIH_DOCS_ENABLED: enabled ? "true" : "false",
	});
}

describe("openapi-docs", () => {
	test("returns 404 for docs routes when disabled", async () => {
		const app = createApp({ env: docsEnv(false), otelEnabled: false });
		const spec = await app.handle(
			new Request("http://localhost/v1/openapi.json"),
		);
		const ui = await app.handle(new Request("http://localhost/docs"));
		expect(spec.status).toBe(404);
		expect(ui.status).toBe(404);
	});

	test("serves spec and Scalar UI when enabled", async () => {
		const app = createApp({ env: docsEnv(true), otelEnabled: false });
		const spec = await app.handle(
			new Request("http://localhost/v1/openapi.json"),
		);
		const ui = await app.handle(new Request("http://localhost/docs"));
		expect(spec.status).toBe(200);
		expect(ui.status).toBe(200);

		const body = (await spec.json()) as Record<string, unknown>;
		expect(body["x-usetagih-spec-maturity"]).toBe("partial");
		expect((body.info as { title: string }).title).toBe("usetagih API");
		expect(body.components).toBeDefined();
	});
});
