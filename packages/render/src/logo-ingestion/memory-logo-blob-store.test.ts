import { expect, test } from "bun:test";
import { createMemoryLogoBlobStore } from "./memory-logo-blob-store.js";

test("put then get returns identical bytes with workspace isolation", async () => {
	const storeA = createMemoryLogoBlobStore();
	const storeB = createMemoryLogoBlobStore();
	const bytes = Uint8Array.from([1, 2, 3, 4]);
	const key = "logos/ws-a/abc123.png";

	await storeA.put({
		workspaceId: "ws-a",
		storageKey: key,
		body: bytes,
		contentType: "image/png",
	});

	expect(await storeA.get({ workspaceId: "ws-a", storageKey: key })).toEqual(
		bytes,
	);
	expect(await storeA.get({ workspaceId: "ws-b", storageKey: key })).toBeNull();
	expect(await storeB.get({ workspaceId: "ws-a", storageKey: key })).toBeNull();
});

test("findByUrl returns cached ingested logo", () => {
	const store = createMemoryLogoBlobStore();
	const logo = {
		bytes: Uint8Array.from([9, 9, 9]),
		logoChecksum: "deadbeef",
		contentType: "image/png" as const,
		storageKey: "logos/ws-1/deadbeef.png",
	};

	store.putWithUrl({
		workspaceId: "ws-1",
		logoUrl: "https://example.com/logo.png",
		logo,
	});
	const found = store.findByUrl({
		workspaceId: "ws-1",
		logoUrl: "https://example.com/logo.png",
	});
	expect(found?.logoChecksum).toBe("deadbeef");
});
