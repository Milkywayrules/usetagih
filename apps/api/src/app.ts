import type { ApiKeyRepo, AuditRepo } from "@usetagih/core";
import {
	createApiKeyRepo,
	createAuditRepo,
	type Db,
	getDb,
} from "@usetagih/db";
import { Elysia } from "elysia";
import { createBetterAuthPlugin } from "./auth/mount.js";
import { parseApiEnv } from "./env.js";
import { createAuthResolver } from "./middleware/auth-resolver.js";
import { createScopeGuard } from "./middleware/scope-guard.js";
import { createV1Cors } from "./middleware/v1-cors.js";
import { createWorkspaceGuard } from "./middleware/workspace-guard.js";
import { createSignUpWithWorkspaceRoute } from "./routes/auth/sign-up-with-workspace.js";
import { createHealthRoutes } from "./routes/health.js";
import { createApiKeysRoutes } from "./routes/v1/api-keys.js";
import { createAuditStubRoutes } from "./routes/v1/audit.stub.js";
import { createRendersStubRoutes } from "./routes/v1/renders.stub.js";
import { createSessionCsrfRoute } from "./routes/v1/session.csrf.js";
import { createSessionTokenRoute } from "./routes/v1/session.token.js";
import { createWebhooksStubRoutes } from "./routes/v1/webhooks.stub.js";

export type AppDeps = {
	db?: Db;
	auditRepo?: AuditRepo;
	apiKeyRepo?: ApiKeyRepo;
	env?: ReturnType<typeof parseApiEnv>;
};

export function createApp(deps: AppDeps = {}) {
	const env = deps.env ?? parseApiEnv();
	const db = deps.db ?? getDb();
	const auditRepo = deps.auditRepo ?? createAuditRepo(db);
	const apiKeyRepo = deps.apiKeyRepo ?? createApiKeyRepo(db);

	const betterAuth = createBetterAuthPlugin({
		apiPublicUrl: env.USETAGIH_API_PUBLIC_URL,
		webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL,
	});
	const workspaceGuard = createWorkspaceGuard();
	const authResolver = createAuthResolver({ env, apiKeyRepo });
	const scopeGuard = createScopeGuard();
	const v1Cors = createV1Cors({ webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL });

	return new Elysia()
		.use(createHealthRoutes())
		.use(createSignUpWithWorkspaceRoute({ auditRepo, env }))
		.use(betterAuth)
		.group("/v1", (app) =>
			app
				.use(v1Cors)
				.use(workspaceGuard)
				.use(authResolver)
				.use(scopeGuard)
				.use(createSessionCsrfRoute({ env }))
				.use(createSessionTokenRoute({ env }))
				.use(createApiKeysRoutes({ apiKeyRepo, auditRepo }))
				.use(createRendersStubRoutes())
				.use(createAuditStubRoutes())
				.use(createWebhooksStubRoutes()),
		);
}
