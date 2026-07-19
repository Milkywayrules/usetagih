import { z } from "zod";
import { CURRENT_SCHEMA_VERSION } from "../version/constants";

export const moneyAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const isoCountrySchema = z
	.string()
	.length(2)
	.regex(/^[A-Z]{2}$/);

export const isoCurrencySchema = z
	.string()
	.length(3)
	.regex(/^[A-Z]{3}$/);

export const cssHexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const httpsUrlSchema = z
	.string()
	.url()
	.refine((url) => url.startsWith("https://"));

export const quantitySchema = z
	.number()
	.positive()
	.refine((value) => {
		const [, fractional = ""] = value.toString().split(".");
		return fractional.length <= 3;
	});

export const taxRateSchema = z.number().min(0).max(1);

export const templateSchema = z.enum(["modern", "classic"]);

export type Template = z.infer<typeof templateSchema>;

export const schemaVersionSchema = z.literal(CURRENT_SCHEMA_VERSION);

export const documentTypeSchema = z.enum(["invoice", "quotation", "receipt"]);
