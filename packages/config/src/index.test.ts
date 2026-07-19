import { expect, test } from "bun:test";
import { CONFIG_STUB } from "./index";

test("config stub export", () => {
  expect(CONFIG_STUB).toBe("usetagih-config-stub");
});
