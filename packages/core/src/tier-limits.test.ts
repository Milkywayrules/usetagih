import { expect, test } from "bun:test";
import {
	currentUsageMonth,
	formatQuotaExceededMessage,
	formatRateLimitedMessage,
	getMonthlyRenderQuota,
	getNextWorkspaceTier,
	getRateLimitRendersPerMin,
	WORKSPACE_TIERS,
} from "./tier-limits.js";

test("WORKSPACE_TIERS covers all tier enums", () => {
	expect(WORKSPACE_TIERS).toEqual(["trial", "starter", "pro", "business"]);
});

test("monthly render quotas match pricing hypothesis", () => {
	expect(getMonthlyRenderQuota("trial")).toBe(100);
	expect(getMonthlyRenderQuota("starter")).toBe(1_000);
	expect(getMonthlyRenderQuota("pro")).toBe(2_000);
	expect(getMonthlyRenderQuota("business")).toBe(10_000);
});

test("rate limits match pricing hypothesis", () => {
	expect(getRateLimitRendersPerMin("trial")).toBe(30);
	expect(getRateLimitRendersPerMin("starter")).toBe(60);
	expect(getRateLimitRendersPerMin("pro")).toBe(120);
	expect(getRateLimitRendersPerMin("business")).toBe(300);
});

test("next tier chain stops at business", () => {
	expect(getNextWorkspaceTier("trial")).toBe("starter");
	expect(getNextWorkspaceTier("starter")).toBe("pro");
	expect(getNextWorkspaceTier("pro")).toBe("business");
	expect(getNextWorkspaceTier("business")).toBeNull();
});

test("quota exceeded message names current and next tier", () => {
	expect(formatQuotaExceededMessage("trial")).toContain("trial");
	expect(formatQuotaExceededMessage("trial")).toContain("starter");
	expect(formatQuotaExceededMessage("business")).toContain("business");
	expect(formatQuotaExceededMessage("business")).not.toContain("Upgrade to");
});

test("rate limited message includes tier limit", () => {
	expect(formatRateLimitedMessage("starter")).toContain("starter");
	expect(formatRateLimitedMessage("starter")).toContain("60");
});

test("currentUsageMonth returns UTC month start", () => {
	expect(currentUsageMonth(new Date("2026-07-20T12:00:00.000Z"))).toBe(
		"2026-07-01",
	);
});
