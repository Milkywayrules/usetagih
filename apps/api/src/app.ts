import type { ApiKeyRepo, AuditRepo, IdempotencyStore } from "@usetagih/core";
import {
	createApiKeyRepo,
	createAuditRepo,
	createIdempotencyStore,
	createWorkspaceSettingsRepo,
	type Db,
	getDb,
	type WorkspaceSettingsRepo,
} from "@usetagih/db";
import { Elysia } from "elysia";
import { createBetterAuthPlugin } from "./auth/mount.js";
import { parseApiEnv } from "./env.js";
import type { PreviewRuntimeDeps } from "./lib/preview-deps.js";
import { createPreviewRuntimeDeps } from "./lib/preview-deps.js";
import { createAuthResolver } from "./middleware/auth-resolver.js";
import { createRequestIdPlugin } from "./middleware/request-id.js";
import { createScopeGuard } from "./middleware/scope-guard.js";
import { createSecurityHeadersPlugin } from "./middleware/security-headers.js";
import { createV1Cors } from "./middleware/v1-cors.js";
import { createV1ErrorHandler } from "./middleware/v1-error-handler.js";
import { createWorkspaceGuard } from "./middleware/workspace-guard.js";
import { createEvlogPlugin } from "./plugins/evlog.js";
import { createOpenapiDocsPlugin } from "./plugins/openapi-docs.js";
import { createSignUpWithWorkspaceRoute } from "./routes/auth/sign-up-with-workspace.js";
import { createHealthRoutes } from "./routes/health.js";
import { createApiKeysRoutes } from "./routes/v1/api-keys.js";
import { createAuditStubRoutes } from "./routes/v1/audit.stub.js";
import { createPreviewByDocumentTypeRoutes } from "./routes/v1/preview-by-document-type.js";
import { createRenderByDocumentTypeStubRoutes } from "./routes/v1/render-by-document-type.stub.js";
import { createRendersStubRoutes } from "./routes/v1/renders.stub.js";
import { createSchemasRoutes } from "./routes/v1/schemas.js";
import { createSessionCsrfRoute } from "./routes/v1/session.csrf.js";
import { createSessionTokenRoute } from "./routes/v1/session.token.js";
import { createValidateByDocumentTypeRoutes } from "./routes/v1/validate-by-document-type.js";
import { createWebhooksStubRoutes } from "./routes/v1/webhooks.stub.js";
import { createOtelRequestIdPlugin } from "./telemetry/otel.js";

export type AppDeps = {
	db?: Db;
	auditRepo?: AuditRepo;
	apiKeyRepo?: ApiKeyRepo;
	idempotencyStore?: IdempotencyStore;
	env?: ReturnType<typeof parseApiEnv>;
	otelEnabled?: boolean;
	onRenderStubInvoked?: () => void;
	previewRuntime?: PreviewRuntimeDeps;
	workspaceSettingsRepo?: WorkspaceSettingsRepo;
};

export function createApp(deps: AppDeps = {}) {
	const env = deps.env ?? parseApiEnv();
	const otelEnabled =
		deps.otelEnabled ?? Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT);
	const db = deps.db ?? getDb();
	const auditRepo = deps.auditRepo ?? createAuditRepo(db);
	const apiKeyRepo = deps.apiKeyRepo ?? createApiKeyRepo(db);
	const idempotencyStore = deps.idempotencyStore ?? createIdempotencyStore(db);
	const workspaceSettingsRepo =
		deps.workspaceSettingsRepo ?? createWorkspaceSettingsRepo(db);
	const previewRuntime = deps.previewRuntime ?? createPreviewRuntimeDeps();

	const betterAuth = createBetterAuthPlugin({
		apiPublicUrl: env.USETAGIH_API_PUBLIC_URL,
		webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL,
	});
	const workspaceGuard = createWorkspaceGuard();
	const authResolver = createAuthResolver({ env, apiKeyRepo });
	const scopeGuard = createScopeGuard();
	const v1Cors = createV1Cors({ webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL });

	return new Elysia()
		.use(createRequestIdPlugin())
		.use(otelEnabled ? createOtelRequestIdPlugin() : new Elysia())
		.use(createEvlogPlugin())
		.use(createSecurityHeadersPlugin())
		.use(createOpenapiDocsPlugin(env))
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
				.use(createSchemasRoutes())
				.use(createValidateByDocumentTypeRoutes())
				.use(
					createPreviewByDocumentTypeRoutes({
						workspaceSettingsRepo,
						previewRuntime,
					}),
				)
				.use(
					createRenderByDocumentTypeStubRoutes({
						idempotencyStore,
						env,
						onRenderStubInvoked: deps.onRenderStubInvoked,
					}),
				)
				.use(createRendersStubRoutes())
				.use(createAuditStubRoutes())
				.use(createWebhooksStubRoutes())
				.use(createV1ErrorHandler()),
		);
}
