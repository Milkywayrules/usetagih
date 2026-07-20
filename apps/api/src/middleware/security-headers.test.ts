import { describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { createApp } from "../app.js";
import {
	API_CONTENT_SECURITY_POLICY,
	DOCS_CONTENT_SECURITY_POLICY,
} from "../middleware/security-headers.js";

const testEnv = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "true" });

describe("security-headers", () => {
	test("sets strict headers on /v1 JSON routes", async () => {
		const app = createApp({ env: testEnv, otelEnabled: false });
		const response = await app.handle(
			new Request("http://localhost/v1/renders"),
		);
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
		expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
			"same-origin",
		);
		expect(response.headers.get("Content-Security-Policy")).toBe(
			API_CONTENT_SECURITY_POLICY,
		);
		expect(response.headers.get("Strict-Transport-Security")).toBeNull();
	});

	test("relaxes CSP only on /docs", async () => {
		const app = createApp({ env: testEnv, otelEnabled: false });
		const response = await app.handle(new Request("http://localhost/docs"));
		expect(response.headers.get("Content-Security-Policy")).toBe(
			DOCS_CONTENT_SECURITY_POLICY,
		);
		expect(response.headers.get("Content-Security-Policy")).not.toBe(
			API_CONTENT_SECURITY_POLICY,
		);
	});
});
