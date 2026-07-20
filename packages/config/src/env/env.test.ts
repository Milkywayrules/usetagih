import { expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS, parseEnv } from "./schema";

test("prod rejects missing DATABASE_URL", () => {
  expect(() =>
    parseEnv("prod", {
      BETTER_AUTH_SECRET: "prod-secret-min-32-characters-long",
      BETTER_AUTH_URL: "https://api.example.com/api/auth",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
      USETAGIH_WEB_PUBLIC_URL: "https://app.example.com",
    })
  ).toThrow();
});

test("prod rejects missing USETAGIH_WEB_PUBLIC_URL", () => {
  expect(() =>
    parseEnv("prod", {
      BETTER_AUTH_SECRET: "prod-secret-min-32-characters-long",
      BETTER_AUTH_URL: "https://api.example.com/api/auth",
      DATABASE_URL: "postgresql://x",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
    })
  ).toThrow();
});

test("prod rejects missing USETAGIH_API_PUBLIC_URL", () => {
  expect(() =>
    parseEnv("prod", {
      BETTER_AUTH_SECRET: "prod-secret-min-32-characters-long",
      BETTER_AUTH_URL: "https://api.example.com/api/auth",
      DATABASE_URL: "postgresql://x",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
    })
  ).toThrow();
});

test("prod rejects missing auth vars", () => {
  expect(() =>
    parseEnv("prod", {
      DATABASE_URL: "postgresql://x",
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
    })
  ).toThrow();
});

test("prod rejects empty DATABASE_URL", () => {
  expect(() =>
    parseEnv("prod", {
      BETTER_AUTH_SECRET: "prod-secret-min-32-characters-long",
      BETTER_AUTH_URL: "https://api.example.com/api/auth",
      DATABASE_URL: "",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
    })
  ).toThrow();
});

test("staging rejects missing vars", () => {
  expect(() => parseEnv("staging", {})).toThrow();
});

test("dev accepts empty input with defaults", () => {
  expect(parseEnv("dev", {})).toEqual({
    BETTER_AUTH_SECRET: DEV_ENV_DEFAULTS.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: DEV_ENV_DEFAULTS.BETTER_AUTH_URL,
    DATABASE_URL: DEV_ENV_DEFAULTS.DATABASE_URL,
    USETAGIH_API_PUBLIC_URL: DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL,
    USETAGIH_WEB_PUBLIC_URL: DEV_ENV_DEFAULTS.USETAGIH_WEB_PUBLIC_URL,
  });
});

test("dev accepts overrides", () => {
  expect(
    parseEnv("dev", {
      BETTER_AUTH_SECRET: "custom-dev-secret-min-32-chars-000",
      BETTER_AUTH_URL: "http://127.0.0.1:3001/api/auth",
      DATABASE_URL: "postgresql://custom",
      USETAGIH_API_PUBLIC_URL: "http://127.0.0.1:3001",
      USETAGIH_WEB_PUBLIC_URL: "http://127.0.0.1:3000",
    })
  ).toEqual({
    BETTER_AUTH_SECRET: "custom-dev-secret-min-32-chars-000",
    BETTER_AUTH_URL: "http://127.0.0.1:3001/api/auth",
    DATABASE_URL: "postgresql://custom",
    USETAGIH_API_PUBLIC_URL: "http://127.0.0.1:3001",
    USETAGIH_WEB_PUBLIC_URL: "http://127.0.0.1:3000",
  });
});

test("dev allows optional github oauth vars", () => {
  const env = parseEnv("dev", {
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "test-secret",
  });
  expect(env.GITHUB_CLIENT_ID).toBe("test-client");
  expect(env.GITHUB_CLIENT_SECRET).toBe("test-secret");
});
