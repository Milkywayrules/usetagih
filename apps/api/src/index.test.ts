import { expect, test } from "bun:test";
import { createApp } from "./app.js";

test("createApp returns an Elysia instance", () => {
	const app = createApp();
	expect(app).toBeDefined();
	expect(typeof app.handle).toBe("function");
});

test("health route responds ok", async () => {
	const app = createApp();
	const response = await app.handle(new Request("http://localhost/health"));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: "ok" });
});
