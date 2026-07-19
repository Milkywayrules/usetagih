import { describe, expect, test } from "bun:test";
import { CURRENT_SCHEMA_VERSION } from "../version/constants.js";
import { generateOpenApiComponents, MONEY_AMOUNT_PATTERN } from "./generate.js";

const MONEY_AMOUNT_SOURCE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function unwrapSchemas(
	components: Record<string, unknown>,
): Record<string, unknown> {
	return (
		(
			components as {
				components?: { schemas?: Record<string, unknown> };
				schemas?: Record<string, unknown>;
			}
		).components?.schemas ??
		(components as { schemas?: Record<string, unknown> }).schemas ??
		{}
	);
}

function findPattern(obj: unknown, pattern: string): boolean {
	if (!obj || typeof obj !== "object") return false;
	const record = obj as Record<string, unknown>;
	if (record.pattern === pattern) return true;
	return Object.values(record).some((value) => findPattern(value, pattern));
}

function asObjectSchema(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	return record.type === "object" ? record : undefined;
}

function schemaProperties(value: unknown): Record<string, unknown> | undefined {
	const schema = asObjectSchema(value);
	return schema?.properties as Record<string, unknown> | undefined;
}

describe("generateOpenApiComponents", () => {
	test("emits structural OpenAPI 3.1 component schemas", () => {
		const schemas = unwrapSchemas(generateOpenApiComponents());

		expect(schemas).toHaveProperty("DocumentPayload");
		const docPayload = schemas.DocumentPayload as Record<string, unknown>;
		const oneOf = docPayload.oneOf as Record<string, unknown>[] | undefined;
		expect(oneOf).toBeDefined();
		expect(oneOf).toHaveLength(3);

		const documentTypes = oneOf?.map((variant) => {
			const properties = schemaProperties(variant);
			const documentType = properties?.documentType as
				| { enum?: string[] }
				| undefined;
			expect(documentType?.enum).toHaveLength(1);
			return documentType?.enum?.[0];
		});
		expect(documentTypes).toEqual(
			expect.arrayContaining(["invoice", "quotation", "receipt"]),
		);

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

		const apiErrorDetail = asObjectSchema(schemas.ApiErrorDetail);
		expect(apiErrorDetail?.required).toEqual(["path", "code", "message"]);
		expect(apiErrorDetail?.additionalProperties).toBe(false);
		expect(Object.keys(apiErrorDetail?.properties ?? {})).toEqual([
			"path",
			"code",
			"message",
			"expected",
			"received",
		]);

		expect(MONEY_AMOUNT_PATTERN).toBe(MONEY_AMOUNT_SOURCE_PATTERN.source);
		expect(findPattern(schemas.Money, MONEY_AMOUNT_PATTERN)).toBe(true);

		expect(schemas).toHaveProperty("SchemaMetadata");
		const metaJson = JSON.stringify(schemas.SchemaMetadata);
		expect(metaJson).toContain("modern");
		expect(metaJson).toContain("classic");

		for (const payloadName of [
			"InvoicePayload",
			"QuotationPayload",
			"ReceiptPayload",
		] as const) {
			const properties = schemaProperties(schemas[payloadName]);
			const template = properties?.template as { enum?: string[] } | undefined;
			expect(template?.enum).toEqual(["modern", "classic"]);

			const schemaVersion = properties?.schemaVersion as
				| { default?: string }
				| undefined;
			expect(schemaVersion?.default).toBe(CURRENT_SCHEMA_VERSION);
		}

		const invoicePayloadProperties = schemaProperties(schemas.InvoicePayload);
		const lineItems = invoicePayloadProperties?.lineItems as
			| Record<string, unknown>
			| undefined;
		const lineItemItems = asObjectSchema(lineItems?.items);
		expect(lineItemItems?.required).toEqual([
			"description",
			"quantity",
			"unitPrice",
			"lineTotal",
		]);
		expect(lineItemItems?.additionalProperties).toBe(false);

		const seller = asObjectSchema(invoicePayloadProperties?.seller);
		expect(seller?.required).toEqual(["name"]);
		expect(seller?.additionalProperties).toBe(false);

		const allSchemasJson = JSON.stringify(schemas);
		expect(allSchemasJson).toMatch(/modern/);
		expect(allSchemasJson).toMatch(/classic/);
	});
});
