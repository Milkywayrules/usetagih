import { z } from "zod";

export type DopplerEnvironment = "dev" | "staging" | "prod";

/** Dev defaults aligned with docker/compose.yml and Dockerfile.api EXPOSE 3001 */
export const DEV_ENV_DEFAULTS = {
  BETTER_AUTH_SECRET: "dev-only-min-32-chars-secret-000000",
  BETTER_AUTH_URL: "http://localhost:3001/api/auth",
  DATABASE_URL: "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  USETAGIH_API_PUBLIC_URL: "http://localhost:3001",
  USETAGIH_SHARE_SIGNING_SECRET: "dev-only-share-signing-secret-min-32-chars",
  USETAGIH_WEB_PUBLIC_URL: "http://localhost:3000",
} as const;

export interface EnvStub {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  USETAGIH_API_PUBLIC_URL: string;
  USETAGIH_DOCS_ENABLED: boolean;
  USETAGIH_SHARE_SIGNING_SECRET: string;
  USETAGIH_WEB_PUBLIC_URL: string;
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

const otelFields = {
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
} as const;

/** Doppler and process.env deliver booleans as strings — avoid z.coerce.boolean(). */
const envBoolean = z.preprocess((value) => {
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return value;
}, z.boolean());

const docsEnabledDev = envBoolean.default(true);
const docsEnabledStaging = envBoolean;
const docsEnabledProd = envBoolean.default(false);

export function createEnvSchema(environment: DopplerEnvironment) {
  if (environment === "dev") {
    return z.object({
      DATABASE_URL: z.string().min(1).default(DEV_ENV_DEFAULTS.DATABASE_URL),
      USETAGIH_API_PUBLIC_URL: z
        .string()
        .url()
        .default(DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL),
      USETAGIH_DOCS_ENABLED: docsEnabledDev,
      USETAGIH_SHARE_SIGNING_SECRET: z
        .string()
        .min(32)
        .default(DEV_ENV_DEFAULTS.USETAGIH_SHARE_SIGNING_SECRET),
      USETAGIH_WEB_PUBLIC_URL: z
        .string()
        .url()
        .default(DEV_ENV_DEFAULTS.USETAGIH_WEB_PUBLIC_URL),
      ...authFieldsDev,
      ...otelFields,
    });
  }

  if (environment === "staging") {
    return z.object({
      DATABASE_URL: z.string().min(1),
      USETAGIH_API_PUBLIC_URL: z.string().url(),
      USETAGIH_DOCS_ENABLED: docsEnabledStaging,
      USETAGIH_SHARE_SIGNING_SECRET: z.string().min(32),
      USETAGIH_WEB_PUBLIC_URL: z.string().url(),
      ...authFieldsStrict,
      ...otelFields,
    });
  }

  return z.object({
    DATABASE_URL: z.string().min(1),
    USETAGIH_API_PUBLIC_URL: z.string().url(),
    USETAGIH_DOCS_ENABLED: docsEnabledProd,
    USETAGIH_SHARE_SIGNING_SECRET: z.string().min(32),
    USETAGIH_WEB_PUBLIC_URL: z.string().url(),
    ...authFieldsStrict,
    ...otelFields,
  });
}

export function parseEnv(
  environment: DopplerEnvironment,
  raw: Record<string, string | undefined>
): EnvStub {
  return createEnvSchema(environment).parse(raw);
}
