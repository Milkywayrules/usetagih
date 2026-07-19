import { describe, expect, test } from "bun:test";
import { generateOpenApiComponents, MONEY_AMOUNT_PATTERN } from "./generate.js";

function findPattern(obj: unknown, pattern: string): boolean {
	if (!obj || typeof obj !== "object") return false;
	const record = obj as Record<string, unknown>;
	if (record.pattern === pattern) return true;
	return Object.values(record).some((value) => findPattern(value, pattern));
}

describe("generateOpenApiComponents", () => {
	test("emits structural OpenAPI 3.1 component schemas", () => {
		const components = generateOpenApiComponents();
		const schemas =
			(
				components as {
					components?: { schemas?: Record<string, unknown> };
					schemas?: Record<string, unknown>;
				}
			).components?.schemas ??
			(components as { schemas?: Record<string, unknown> }).schemas ??
			{};

		expect(schemas).toHaveProperty("DocumentPayload");
		const docPayload = schemas.DocumentPayload as Record<string, unknown>;
		expect(
			docPayload.oneOf ?? docPayload.anyOf ?? docPayload.discriminator,
		).toBeDefined();

		if (docPayload.discriminator) {
			const disc = docPayload.discriminator as {
				propertyName?: string;
				mapping?: Record<string, string>;
			};
			expect(disc.propertyName).toBe("documentType");
			if (disc.mapping) {
				expect(Object.keys(disc.mapping)).toEqual(
					expect.arrayContaining(["invoice", "quotation", "receipt"]),
				);
			}
		}

		expect(schemas).toHaveProperty("ApiErrorEnvelope");
		expect(schemas).toHaveProperty("ApiErrorDetail");

		expect(findPattern(schemas.Money, MONEY_AMOUNT_PATTERN)).toBe(true);

		expect(schemas).toHaveProperty("SchemaMetadata");
		const metaJson = JSON.stringify(schemas.SchemaMetadata);
		expect(metaJson).toContain("modern");
		expect(metaJson).toContain("classic");

		const allSchemasJson = JSON.stringify(schemas);
		expect(allSchemasJson).toMatch(/modern/);
		expect(allSchemasJson).toMatch(/classic/);
	});
});
