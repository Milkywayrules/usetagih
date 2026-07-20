import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { fetchLogoSsrfSafe } from "./fetch-logo.js";

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function mockResponse(params: {
	statusCode?: number;
	body?: Buffer;
	headers?: Record<string, string>;
}): { statusCode: number; headers: Record<string, string>; body: Buffer } {
	return {
		statusCode: params.statusCode ?? 200,
		headers: params.headers ?? {},
		body: params.body ?? PNG_BYTES,
	};
}

test("rejects non-https schemes and IP literal hosts", async () => {
	expect((await fetchLogoSsrfSafe("http://example.com/logo.png")).ok).toBe(
		false,
	);
	expect((await fetchLogoSsrfSafe("file:///etc/passwd")).ok).toBe(false);
	expect((await fetchLogoSsrfSafe("data:text/plain,hi")).ok).toBe(false);
	expect((await fetchLogoSsrfSafe("https://127.0.0.1/logo.png")).ok).toBe(
		false,
	);
});

test("blocks private IP from DNS lookup before connect", async () => {
	const blocked = await fetchLogoSsrfSafe("https://metadata.example/logo.png", {
		lookup: async () => [{ address: "169.254.169.254", family: 4 }],
		requestImpl: async () => mockResponse({}),
	});
	expect(blocked.ok).toBe(false);
	if (!blocked.ok) {
		expect(blocked.reason).toContain("blocked address");
	}
});

test("blocks when any resolved address is private", async () => {
	const blocked = await fetchLogoSsrfSafe(
		"https://dual-stack.example/logo.png",
		{
			lookup: async () => [
				{ address: "8.8.8.8", family: 4 },
				{ address: "10.0.0.1", family: 4 },
			],
			requestImpl: async () => mockResponse({}),
		},
	);
	expect(blocked.ok).toBe(false);
});

test("caps redirects at three and rejects non-https redirect targets", async () => {
	let calls = 0;
	const redirectCap = await fetchLogoSsrfSafe("https://example.com/logo.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () => {
			calls += 1;
			return mockResponse({
				statusCode: 302,
				headers: { location: "https://example.com/next.png" },
				body: Buffer.alloc(0),
			});
		},
		maxRedirects: 3,
	});
	expect(redirectCap.ok).toBe(false);
	expect(calls).toBe(4);

	const httpRedirect = await fetchLogoSsrfSafe("https://example.com/logo.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () =>
			mockResponse({
				statusCode: 302,
				headers: { location: "http://example.com/insecure.png" },
				body: Buffer.alloc(0),
			}),
	});
	expect(httpRedirect.ok).toBe(false);
});

test("rejects oversize raw bodies", async () => {
	const oversize = Buffer.alloc(2_097_153, 0x41);
	const result = await fetchLogoSsrfSafe("https://example.com/huge.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () => mockResponse({ body: oversize }),
	});
	expect(result.ok).toBe(false);
});

test("rejects decompression bombs", async () => {
	const compressed = gzipSync(Buffer.alloc(11_000_000, 0x41));
	const result = await fetchLogoSsrfSafe("https://example.com/bomb.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () =>
			mockResponse({
				body: compressed,
				headers: { "content-encoding": "gzip" },
			}),
	});
	expect(result.ok).toBe(false);
});

test("rejects wrong magic bytes even with image content-type", async () => {
	const htmlBody = Buffer.from("<html>not an image</html>", "utf8");
	const result = await fetchLogoSsrfSafe("https://example.com/fake.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () =>
			mockResponse({
				body: htmlBody,
				headers: { "content-type": "image/png" },
			}),
	});
	expect(result.ok).toBe(false);
});

test("accepts valid PNG bytes", async () => {
	const result = await fetchLogoSsrfSafe("https://example.com/logo.png", {
		lookup: async () => [{ address: "8.8.8.8", family: 4 }],
		requestImpl: async () => mockResponse({ body: PNG_BYTES }),
	});
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.contentType).toBe("image/png");
	}
});
