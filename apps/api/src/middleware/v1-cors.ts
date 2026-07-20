import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { CSRF_HEADER } from "./csrf.js";

export function createV1Cors(options: { webPublicUrl: string }) {
	return new Elysia({ name: "v1-cors" }).use(
		cors({
			origin: options.webPublicUrl,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization", CSRF_HEADER],
		}),
	);
}
