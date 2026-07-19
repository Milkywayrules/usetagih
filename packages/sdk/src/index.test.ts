import { expect, test } from "bun:test";
import { SDK_STUB, sdkSchemaRef } from "./index";

test("sdk stub re-exports schema", () => {
  expect(SDK_STUB).toBe("usetagih-sdk-stub");
  expect(sdkSchemaRef).toBe("usetagih-schema-stub");
});
