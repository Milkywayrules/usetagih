import type { AuditRepo } from "@usetagih/core";
import { createAuditRepo, type Db, getDb } from "@usetagih/db";
import { Elysia } from "elysia";
import { createBetterAuthPlugin } from "./auth/mount.js";
import { parseApiEnv } from "./env.js";
import { createWorkspaceGuard } from "./middleware/workspace-guard.js";
import { createSignUpWithWorkspaceRoute } from "./routes/auth/sign-up-with-workspace.js";
import { createHealthRoutes } from "./routes/health.js";

export type AppDeps = {
	db?: Db;
	auditRepo?: AuditRepo;
	env?: ReturnType<typeof parseApiEnv>;
};

export function createApp(deps: AppDeps = {}) {
	const env = deps.env ?? parseApiEnv();
	const db = deps.db ?? getDb();
	const auditRepo = deps.auditRepo ?? createAuditRepo(db);

	const betterAuth = createBetterAuthPlugin({
		apiPublicUrl: env.USETAGIH_API_PUBLIC_URL,
	});
	const workspaceGuard = createWorkspaceGuard();

	return new Elysia()
		.use(createHealthRoutes())
		.use(createSignUpWithWorkspaceRoute({ auditRepo }))
		.use(betterAuth)
		.group("/v1", (app) =>
			app.use(workspaceGuard).get(
				"/renders",
				({ set }) => {
					set.status = 501;
					return {
						error: {
							code: "NOT_IMPLEMENTED",
							message: "Render list lands in Story 3.12",
						},
					};
				},
				{ workspace: true },
			),
		);
}
