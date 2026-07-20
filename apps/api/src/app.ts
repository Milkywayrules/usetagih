import type {
	ApiKeyRepo,
	AuditRepo,
	IdempotencyStore,
	RenderLimitsService,
	RenderRepo,
	UsageCounterRepo,
} from "@usetagih/core";
import {
	createInMemoryRenderRateLimiter,
	createRenderLimitsService,
} from "@usetagih/core";
import {
	createApiKeyRepo,
	createAuditRepo,
	createIdempotencyStore,
	createRenderRepo,
	createUsageCounterRepo,
	createWorkspaceSettingsRepo,
	type Db,
	getDb,
	schema,
	type WorkspaceSettingsRepo,
} from "@usetagih/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { createBetterAuthPlugin } from "./auth/mount.js";
import { parseApiEnv } from "./env.js";
import type { PreviewRuntimeDeps } from "./lib/preview-deps.js";
import { createPreviewRuntimeDeps } from "./lib/preview-deps.js";
import type { RenderRuntimeDeps } from "./lib/render-deps.js";
import { createRenderRuntimeDeps } from "./lib/render-deps.js";
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
import { createAuditRoutes } from "./routes/v1/audit.js";
import { createPreviewByDocumentTypeRoutes } from "./routes/v1/preview-by-document-type.js";
import { createRenderByDocumentTypeRoutes } from "./routes/v1/render-by-document-type.js";
import { createRendersRoutes } from "./routes/v1/renders.js";
import { createSchemasRoutes } from "./routes/v1/schemas.js";
import { createSessionCsrfRoute } from "./routes/v1/session.csrf.js";
import { createSessionTokenRoute } from "./routes/v1/session.token.js";
import { createSettingsRoutes } from "./routes/v1/settings.js";
import { createShareRoutes } from "./routes/v1/share.js";
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
	onRenderInvoked?: () => void;
	previewRuntime?: PreviewRuntimeDeps;
	renderRuntime?: RenderRuntimeDeps;
	renderRepo?: RenderRepo;
	renderLimits?: RenderLimitsService;
	usageCounterRepo?: UsageCounterRepo;
	resolveAuditUserId?: (
		workspaceId: string,
		userId?: string,
	) => Promise<string | null>;
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
	const renderRepo = deps.renderRepo ?? createRenderRepo(db);
	const renderRuntime = deps.renderRuntime ?? createRenderRuntimeDeps();
	const renderLimits =
		deps.renderLimits ??
		createRenderLimitsService({
			usageCounterRepo: deps.usageCounterRepo ?? createUsageCounterRepo(db),
			renderRateLimiter: createInMemoryRenderRateLimiter(),
		});

	const betterAuth = createBetterAuthPlugin({
		apiPublicUrl: env.USETAGIH_API_PUBLIC_URL,
		webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL,
	});
	const workspaceGuard = createWorkspaceGuard();
	const authResolver = createAuthResolver({ env, apiKeyRepo });
	const scopeGuard = createScopeGuard();
	const v1Cors = createV1Cors({ webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL });
	const resolveAuditUserId =
		deps.resolveAuditUserId ??
		(async (workspaceId: string, userId?: string) => {
			if (userId) {
				return userId;
			}
			const [memberRow] = await db
				.select({ userId: schema.member.userId })
				.from(schema.member)
				.where(eq(schema.member.organizationId, workspaceId))
				.limit(1);
			return memberRow?.userId ?? null;
		});

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
				.use(
					createValidateByDocumentTypeRoutes({
						auditRepo,
						resolveAuditUserId,
					}),
				)
				.use(
					createPreviewByDocumentTypeRoutes({
						workspaceSettingsRepo,
						previewRuntime,
					}),
				)
				.use(
					createRenderByDocumentTypeRoutes({
						idempotencyStore,
						env,
						renderRepo,
						workspaceSettingsRepo,
						renderRuntime,
						auditRepo,
						resolveAuditUserId,
						onRenderInvoked: deps.onRenderInvoked,
						renderLimits,
					}),
				)
				.use(
					createRendersRoutes({
						renderRepo,
						artifactStore: renderRuntime.artifactStore,
						auditRepo,
						webPublicUrl: env.USETAGIH_WEB_PUBLIC_URL,
						resolveAuditUserId,
					}),
				)
				.use(
					createShareRoutes({
						renderRepo,
						artifactStore: renderRuntime.artifactStore,
						shareSigningSecret: env.USETAGIH_SHARE_SIGNING_SECRET,
					}),
				)
				.use(createAuditRoutes({ auditRepo }))
				.use(
					createSettingsRoutes({
						workspaceSettingsRepo,
						logoBlobStore: renderRuntime.logoBlobStore,
						apiPublicUrl: env.USETAGIH_API_PUBLIC_URL,
					}),
				)
				.use(createWebhooksStubRoutes())
				.use(createV1ErrorHandler()),
		);
}
