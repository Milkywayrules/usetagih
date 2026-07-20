import { expect, test } from "bun:test";
import { mapWorkspaceTierToTypstTier } from "./tier-map.js";

test("mapWorkspaceTierToTypstTier maps trial to free watermark tier", () => {
	expect(mapWorkspaceTierToTypstTier("trial")).toBe("free");
});

test("mapWorkspaceTierToTypstTier maps paid tiers to pro", () => {
	expect(mapWorkspaceTierToTypstTier("starter")).toBe("pro");
	expect(mapWorkspaceTierToTypstTier("pro")).toBe("pro");
	expect(mapWorkspaceTierToTypstTier("business")).toBe("pro");
});
