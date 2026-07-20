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
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb } from "../client.js";
import * as schema from "../schema/index.js";

export const authConfig = {
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
	plugins: [
		organization({
			teams: { enabled: false },
		}),
	],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authConfig);
