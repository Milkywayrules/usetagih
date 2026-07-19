import { expect, test } from "bun:test";
import { DocumentPayloadSchema } from "@usetagih/schema";
import { CORE_STUB, coreSchemaRef } from "./index";

test("core stub re-exports schema", () => {
	expect(CORE_STUB).toBe("usetagih-core-stub");
	expect(coreSchemaRef).toBe(DocumentPayloadSchema);
});
