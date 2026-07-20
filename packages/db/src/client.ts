import { parseEnv } from "@usetagih/config/env";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString?: string): {
	db: Db;
	sql: postgres.Sql;
} {
	const env = parseEnv("dev", {
		DATABASE_URL: connectionString ?? process.env.DATABASE_URL,
		USETAGIH_API_PUBLIC_URL: process.env.USETAGIH_API_PUBLIC_URL,
	});
	const sql = postgres(env.DATABASE_URL, { max: 1 });
	const db = drizzle(sql, { schema });
	return { db, sql };
}

/** Lazy singleton for auth config / CLI — avoids connecting until first use. */
let lazyDb: Db | undefined;

export function getDb(): Db {
	if (!lazyDb) {
		lazyDb = createDb().db;
	}
	return lazyDb;
}

export async function probeDb(connectionString?: string): Promise<boolean> {
	const env = parseEnv("dev", {
		DATABASE_URL: connectionString ?? process.env.DATABASE_URL,
		USETAGIH_API_PUBLIC_URL: process.env.USETAGIH_API_PUBLIC_URL,
	});
	const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 3 });
	try {
		await sql`SELECT 1`;
		return true;
	} catch {
		return false;
	} finally {
		await sql.end({ timeout: 1 });
	}
}
