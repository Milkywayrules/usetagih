import { DocumentPayloadSchema } from "@usetagih/schema";

/** Placeholder SDK export — HTTP client lands in Epic 7. */
export const SDK_STUB = "usetagih-sdk-stub" as const;

/** @internal wires schema workspace dependency for stub builds */
export const sdkSchemaRef = DocumentPayloadSchema;
