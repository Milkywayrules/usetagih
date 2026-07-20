import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { getSchemaMetadata } from "@usetagih/schema";
import { createApp } from "../../app.js";
import { signSessionBearerToken } from "../../auth/session-token.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

describe("GET /v1/schemas", () => {
	let app: ReturnType<typeof createApp>;

	beforeAll(() => {
		app = createApp({ env, otelEnabled: false });
	});

	test("unauthenticated → 200 with getSchemaMetadata() body", async () => {
		const response = await app.handle(
			new Request("http://localhost/v1/schemas"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual(getSchemaMetadata());
		expect(body).toEqual({
			schemaVersion: "2026-07-20",
			supportedVersions: ["2026-07-20"],
			documentTypes: ["invoice", "quotation", "receipt"],
			templates: {
				invoice: ["modern", "classic"],
				quotation: ["modern", "classic"],
				receipt: ["modern", "classic"],
			},
		});
	});

	test("authenticated session bearer → 200 with identical body", async () => {
		const signed = await signSessionBearerToken(
			{
				userId: crypto.randomUUID(),
				workspaceId: crypto.randomUUID(),
			},
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/schemas", {
				headers: { Authorization: `Bearer ${signed.accessToken}` },
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual(getSchemaMetadata());
	});
});
