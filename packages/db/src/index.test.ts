import { expect, test } from "bun:test";
import { DB_STUB } from "./index";

test("db stub export", () => {
	expect(DB_STUB).toBe("usetagih-db-stub");
});
