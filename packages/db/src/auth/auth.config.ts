/**
 * Auth config seam — Story 3.1 creates; Story 3.3 extends for HTTP runtime.
 *
 * CLI schema generation uses npm `auth@1.6.23` (official Better Auth CLI from
 * github.com/better-auth/better-auth packages/cli). The scoped
 * `@better-auth/cli@1.6.23` package is not published; `auth` is not a typosquat.
 *
 * Organization plugin contract (board: single-user workspaces, no invites):
 * - `teams.enabled: false` — no team tables or team routes (schema verified).
 * - `invitation` / `member` tables are plugin-required furniture; rows for
 *   bootstrap owner membership only. Story 3.3 MUST additionally block:
 *   createInvitation, acceptInvitation, addMember, join flows (e.g.
 *   `invitationLimit: 0`, `membershipLimit: 1`, rejecting hooks, or route
 *   omission). Do not re-enable teams or multi-member invites here.
 */
import { parseEnv } from "@usetagih/config/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getIp } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";
import { getDb } from "../client.js";
import { createAuditRepo } from "../repositories/audit-repo.js";
import { member } from "../schema/better-auth.js";
import * as schema from "../schema/index.js";
import { workspaceSettings } from "../schema/workspace-settings.js";

const env = parseEnv(
	(process.env.DOPPLER_ENVIRONMENT as "dev" | "staging" | "prod") ?? "dev",
	process.env,
);

function getAuditRepo() {
	return createAuditRepo(getDb());
}

export const authConfig = {
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.USETAGIH_API_PUBLIC_URL],
	database: drizzleAdapter(getDb(), {
		provider: "pg",
		schema,
	}),
	emailAndPassword: { enabled: true },
	advanced: {
		database: {
			generateId: "uuid",
		},
	},
	socialProviders:
		env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
			? {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET,
					},
				}
			: undefined,
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/sign-in/email") {
				return;
			}

			const returned = ctx.context.returned as
				| { user?: { id: string }; token?: string | null }
				| undefined;
			if (!returned?.user?.id) {
				return;
			}

			const auditRepo = getAuditRepo();
			const ip =
				ctx.request != null
					? (getIp(ctx.request, ctx.context.options) ?? null)
					: null;
			await auditRepo.append({
				action: "login",
				workspaceId: null,
				userId: returned.user.id,
				outcome: "success",
				ip,
			});
		}),
	},
	plugins: [
		organization({
			teams: { enabled: false },
			membershipLimit: 1,
			invitationLimit: 0,
			allowUserToCreateOrganization: true,
			organizationLimit: 10,
			organizationHooks: {
				beforeCreateInvitation: async () => {
					throw new APIError("FORBIDDEN", {
						message: "Invitations are disabled",
					});
				},
				beforeAcceptInvitation: async () => {
					throw new APIError("FORBIDDEN", {
						message: "Invitations are disabled",
					});
				},
				beforeAddMember: async ({ organization }) => {
					const db = getDb();
					const [row] = await db
						.select({ total: count() })
						.from(member)
						.where(eq(member.organizationId, organization.id));
					if ((row?.total ?? 0) >= 1) {
						throw new APIError("FORBIDDEN", {
							message: "Multi-member workspaces are disabled",
						});
					}
				},
				afterCreateOrganization: async ({ organization, user }) => {
					const db = getDb();
					const auditRepo = getAuditRepo();
					await db.insert(workspaceSettings).values({
						organizationId: organization.id,
						tier: "trial",
					});
					await auditRepo.append({
						action: "workspace.bootstrap",
						workspaceId: organization.id,
						userId: user.id,
						outcome: "success",
					});
				},
			},
		}),
	],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authConfig);
