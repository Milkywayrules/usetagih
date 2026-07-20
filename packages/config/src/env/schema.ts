import { z } from "zod";

export type DopplerEnvironment = "dev" | "staging" | "prod";

/** Dev defaults aligned with docker/compose.yml and Dockerfile.api EXPOSE 3001 */
export const DEV_ENV_DEFAULTS = {
  BETTER_AUTH_SECRET: "dev-only-min-32-chars-secret-000000",
  BETTER_AUTH_URL: "http://localhost:3001/api/auth",
  DATABASE_URL: "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  USETAGIH_API_PUBLIC_URL: "http://localhost:3001",
} as const;

export interface EnvStub {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  USETAGIH_API_PUBLIC_URL: string;
}

const authFieldsDev = {
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default(DEV_ENV_DEFAULTS.BETTER_AUTH_SECRET),
  BETTER_AUTH_URL: z.string().url().default(DEV_ENV_DEFAULTS.BETTER_AUTH_URL),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
} as const;

const authFieldsStrict = {
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
} as const;

export function createEnvSchema(environment: DopplerEnvironment) {
  if (environment === "dev") {
    return z.object({
      DATABASE_URL: z.string().min(1).default(DEV_ENV_DEFAULTS.DATABASE_URL),
      USETAGIH_API_PUBLIC_URL: z
        .string()
        .url()
        .default(DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL),
      ...authFieldsDev,
    });
  }

  // staging and prod: strict — no defaults
  return z.object({
    DATABASE_URL: z.string().min(1),
    USETAGIH_API_PUBLIC_URL: z.string().url(),
    ...authFieldsStrict,
  });
}

export function parseEnv(
  environment: DopplerEnvironment,
  raw: Record<string, string | undefined>
): EnvStub {
  return createEnvSchema(environment).parse(raw);
}
