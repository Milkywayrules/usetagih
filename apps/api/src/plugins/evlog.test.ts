import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { initLogger } from "evlog";
import {
	clearMemoryLogs,
	createMemoryDrain,
	readMemoryLogs,
} from "evlog/memory";
import type { AuthContext } from "../middleware/auth-context.js";
import { createRequestIdPlugin } from "../middleware/request-id.js";
import { createEvlogPlugin } from "./evlog.js";

const MEMORY_STORE = "evlog-test";
const memoryDrain = createMemoryDrain({ store: MEMORY_STORE });

async function waitForLatestEvent(store: string, timeoutMs = 500) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const events = readMemoryLogs({ store, limit: 5 });
		const latest = events.at(-1);
		if (latest) {
			return latest;
		}
		await Bun.sleep(10);
	}
	return undefined;
}

function createTestEvlogApp(options?: {
	authContext?: Pick<AuthContext, "workspaceId">;
}) {
	return new Elysia()
		.use(createRequestIdPlugin())
		.use(createEvlogPlugin({ drain: memoryDrain }))
		.derive({ as: "global" }, () =>
			options?.authContext ? { authContext: options.authContext } : {},
		)
		.get("/ping", () => ({ ok: true }));
}

beforeEach(() => {
	clearMemoryLogs(MEMORY_STORE);
	initLogger({
		env: { service: "usetagih-api-test" },
	});
});

describe("evlog plugin", () => {
	test("includes requestId in wide event", async () => {
		const app = createTestEvlogApp();
		const response = await app.handle(new Request("http://localhost/ping"));
		expect(response.status).toBe(200);

		const latest = await waitForLatestEvent(MEMORY_STORE);
		expect(latest?.requestId).toMatch(/^req_/);
		expect(latest?.stage).toBe("http_request");
	});

	test("includes workspaceId when auth context is present", async () => {
		const app = createTestEvlogApp({
			authContext: { workspaceId: "ws_test_123" },
		});
		const response = await app.handle(new Request("http://localhost/ping"));
		expect(response.status).toBe(200);

		const latest = await waitForLatestEvent(MEMORY_STORE);
		expect(latest?.workspaceId).toBe("ws_test_123");
	});
});
