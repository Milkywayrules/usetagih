import { expect, test } from "bun:test";
import { API_STUB } from "./index";

test("api stub export", () => {
	expect(API_STUB).toBe("usetagih-api-stub");
});
