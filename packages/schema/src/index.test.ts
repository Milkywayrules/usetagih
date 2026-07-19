import { expect, test } from "bun:test";
import { SCHEMA_STUB } from "./index";

test("schema stub export", () => {
	expect(SCHEMA_STUB).toBe("usetagih-schema-stub");
});
