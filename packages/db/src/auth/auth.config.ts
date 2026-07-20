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
