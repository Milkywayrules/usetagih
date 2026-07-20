import { expect, test } from "bun:test";
import type { IngestedLogo } from "../ports/logo-blob-store.js";
import { mergeBranding, resolveLogoUseCase } from "./resolve-logo-use-case.js";

const SAMPLE_LOGO: IngestedLogo = {
	bytes: Uint8Array.from([1, 2, 3]),
	logoChecksum: "abc123",
	contentType: "image/png",
	storageKey: "logos/ws-1/abc123.png",
};

test("mergeBranding prefers payload logoUrl over workspace default", () => {
	const merged = mergeBranding(
		{ logoUrl: "https://workspace.example/logo.png", accentColor: "#111111" },
		{ logoUrl: "https://payload.example/logo.png" },
	);
	expect(merged.logoUrl).toBe("https://payload.example/logo.png");
	expect(merged.accentColor).toBe("#111111");
});

test("returns null logo when no logoUrl in either branding source", async () => {
	const result = await resolveLogoUseCase(
		{ workspaceId: "ws-1", workspaceBranding: { accentColor: "#fff" } },
		{
			ingestFromUrl: async () => SAMPLE_LOGO,
			getStoredLogo: async () => null,
			storeLogo: async () => {},
		},
	);

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.logo).toBeNull();
	}
});

test("falls back to workspace branding when payload has no logoUrl", async () => {
	let ingestedUrl = "";
	const result = await resolveLogoUseCase(
		{
			workspaceId: "ws-1",
			workspaceBranding: { logoUrl: "https://workspace.example/logo.png" },
			payloadBranding: { accentColor: "#000" },
		},
		{
			ingestFromUrl: async (url) => {
				ingestedUrl = url;
				return SAMPLE_LOGO;
			},
			getStoredLogo: async () => null,
			storeLogo: async () => {},
		},
	);

	expect(result.ok).toBe(true);
	expect(ingestedUrl).toBe("https://workspace.example/logo.png");
});

test("skips network fetch on URL cache hit", async () => {
	let fetchCount = 0;
	const store = new Map<string, IngestedLogo>();

	const deps = {
		ingestFromUrl: async (url: string) => {
			fetchCount += 1;
			return { ...SAMPLE_LOGO, storageKey: `logos/ws-1/${url}.png` };
		},
		getStoredLogo: async () => null,
		storeLogo: async (
			logo: IngestedLogo & { workspaceId: string; logoUrl: string },
		) => {
			store.set(logo.logoUrl, logo);
		},
		findLogoByUrl: async ({
			logoUrl,
		}: {
			workspaceId: string;
			logoUrl: string;
		}) => store.get(logoUrl) ?? null,
	};

	const input = {
		workspaceId: "ws-1",
		payloadBranding: { logoUrl: "https://cdn.example/logo.png" },
	};

	const first = await resolveLogoUseCase(input, deps);
	expect(first.ok).toBe(true);
	expect(fetchCount).toBe(1);

	const second = await resolveLogoUseCase(input, deps);
	expect(second.ok).toBe(true);
	expect(fetchCount).toBe(1);
	if (second.ok) {
		expect(second.logo?.logoChecksum).toBe(
			first.ok ? first.logo?.logoChecksum : undefined,
		);
	}
});

test("maps ingestion failures to VALIDATION_FAILED on /branding/logoUrl", async () => {
	const result = await resolveLogoUseCase(
		{
			workspaceId: "ws-1",
			payloadBranding: { logoUrl: "https://blocked.example/logo.png" },
		},
		{
			ingestFromUrl: async () => {
				throw new Error("logoUrl hostname resolves to blocked address");
			},
			getStoredLogo: async () => null,
			storeLogo: async () => {},
		},
	);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.code).toBe("VALIDATION_FAILED");
		expect(result.path).toBe("/branding/logoUrl");
	}
});
