import { Elysia } from "elysia";
import { type EvlogElysiaOptions, evlog } from "evlog/elysia";
import type { AuthContext } from "../middleware/auth-context.js";

export function createEvlogPlugin(options?: EvlogElysiaOptions) {
	return new Elysia({ name: "evlog-enrichment" })
		.use(evlog(options))
		.onAfterHandle({ as: "global" }, (ctx) => {
			const { log, store } = ctx;
			const requestId = (store as { requestId: string }).requestId;
			log.set({
				requestId,
				stage: "http_request",
			});
			const workspaceId = (ctx as { authContext?: AuthContext }).authContext
				?.workspaceId;
			if (workspaceId) {
				log.set({ workspaceId });
			}
		});
}
