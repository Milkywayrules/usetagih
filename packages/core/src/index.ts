import { DocumentPayloadSchema } from "@usetagih/schema";

/** Placeholder core export — hexagonal ports land in Epic 3. */
export const CORE_STUB = "usetagih-core-stub" as const;

/** @internal wires schema workspace dependency for stub builds */
export const coreSchemaRef = DocumentPayloadSchema;
