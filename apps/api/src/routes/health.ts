import { Elysia } from "elysia";

export function createHealthRoutes() {
	return new Elysia().get("/health", () => ({ status: "ok" }));
}
