import { describe, expect, test } from "bun:test";

describe("openapi zod bootstrap", () => {
	test("schemas loaded before registry still expose .openapi()", async () => {
		await import("../document/document-payload.js");
		const { DocumentPayloadSchema } = await import(
			"../document/document-payload.js"
		);
		const { openApiRegistry } = await import("./registry.js");

		expect(typeof DocumentPayloadSchema.openapi).toBe("function");
		expect(openApiRegistry.definitions.length).toBeGreaterThan(0);
	});
});
