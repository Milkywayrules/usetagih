import "./extend-zod.js";

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { DocumentPayloadSchema } from "../document/document-payload";
import { InvoicePayloadSchema } from "../document/invoice-payload";
import { MoneySchema } from "../document/money";
import { QuotationPayloadSchema } from "../document/quotation-payload";
import { ReceiptPayloadSchema } from "../document/receipt-payload";
import { ApiErrorDetailSchema } from "../errors/detail";
import { ApiErrorEnvelopeSchema } from "../errors/envelope";
import { SchemaMetadataSchema } from "../version/metadata";

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.register("DocumentPayload", DocumentPayloadSchema);
openApiRegistry.register("InvoicePayload", InvoicePayloadSchema);
openApiRegistry.register("QuotationPayload", QuotationPayloadSchema);
openApiRegistry.register("ReceiptPayload", ReceiptPayloadSchema);
openApiRegistry.register("ApiErrorEnvelope", ApiErrorEnvelopeSchema);
openApiRegistry.register("ApiErrorDetail", ApiErrorDetailSchema);
openApiRegistry.register("Money", MoneySchema);
openApiRegistry.register("SchemaMetadata", SchemaMetadataSchema);
