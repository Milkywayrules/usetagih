import { expect, test } from "bun:test";
import { RENDER_STUB } from "./index";

test("render stub export", () => {
	expect(RENDER_STUB).toBe("usetagih-render-stub");
});
