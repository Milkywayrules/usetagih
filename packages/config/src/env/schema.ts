import { z } from "zod";

export type DopplerEnvironment = "dev" | "staging" | "prod";

/** Dev defaults aligned with docker/compose.yml and Dockerfile.api EXPOSE 3001 */
export const DEV_ENV_DEFAULTS = {
  DATABASE_URL: "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  USETAGIH_API_PUBLIC_URL: "http://localhost:3001",
} as const;

export interface EnvStub {
  DATABASE_URL: string;
  USETAGIH_API_PUBLIC_URL: string;
}

export function createEnvSchema(environment: DopplerEnvironment) {
  if (environment === "dev") {
    return z.object({
      DATABASE_URL: z.string().min(1).default(DEV_ENV_DEFAULTS.DATABASE_URL),
      USETAGIH_API_PUBLIC_URL: z
        .string()
        .url()
        .default(DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL),
    });
  }

  // staging and prod: strict — no defaults
  return z.object({
    DATABASE_URL: z.string().min(1),
    USETAGIH_API_PUBLIC_URL: z.string().url(),
  });
}

export function parseEnv(
  environment: DopplerEnvironment,
  raw: Record<string, string | undefined>
): EnvStub {
  return createEnvSchema(environment).parse(raw);
}
