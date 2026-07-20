import { expect, test } from "bun:test";
import { computeLogoChecksum } from "../render-record.js";
import { ingestLogoFromBytes, ingestLogoFromUrl } from "./ingest-logo.js";

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const CLEAN_SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#000"/></svg>',
	"utf8",
);

const MALICIOUS_SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>',
	"utf8",
);

test("ingests PNG and computes checksum of persisted bytes", async () => {
	const result = await ingestLogoFromUrl(
		"https://example.com/logo.png",
		"ws-1",
		{
			lookup: async () => [{ address: "8.8.8.8", family: 4 }],
			requestImpl: async () => ({
				statusCode: 200,
				headers: {},
				body: PNG_BYTES,
			}),
		},
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.logo.logoChecksum).toBe(computeLogoChecksum(PNG_BYTES));
		expect(result.logo.storageKey).toMatch(/^logos\/ws-1\/[a-f0-9]{64}\.png$/);
	}
});

test("sanitizes SVG and checksums post-sanitization bytes", async () => {
	const result = await ingestLogoFromUrl(
		"https://example.com/logo.svg",
		"ws-1",
		{
			lookup: async () => [{ address: "8.8.8.8", family: 4 }],
			requestImpl: async () => ({
				statusCode: 200,
				headers: {},
				body: CLEAN_SVG,
			}),
		},
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.logo.contentType).toBe("image/svg+xml");
		expect(result.logo.logoChecksum).toBe(
			computeLogoChecksum(Buffer.from(result.logo.bytes)),
		);
	}
});

test("strips malicious SVG active content and persists sanitized bytes", async () => {
	const result = await ingestLogoFromUrl(
		"https://example.com/evil.svg",
		"ws-1",
		{
			lookup: async () => [{ address: "8.8.8.8", family: 4 }],
			requestImpl: async () => ({
				statusCode: 200,
				headers: {},
				body: MALICIOUS_SVG,
			}),
		},
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		const text = Buffer.from(result.logo.bytes).toString("utf8");
		expect(text.toLowerCase()).not.toContain("<script");
	}
});

test("ingestLogoFromBytes applies same PNG rules as URL ingestion", async () => {
	const result = await ingestLogoFromBytes(PNG_BYTES, "ws-1");

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.logo.logoChecksum).toBe(computeLogoChecksum(PNG_BYTES));
		expect(result.logo.storageKey).toMatch(/^logos\/ws-1\/[a-f0-9]{64}\.png$/);
	}
});

test("ingestLogoFromBytes rejects oversize bytes", async () => {
	const oversized = Buffer.alloc(2_097_153, 0x00);
	oversized[0] = 0x89;
	oversized[1] = 0x50;
	const result = await ingestLogoFromBytes(oversized, "ws-1");
	expect(result.ok).toBe(false);
});
