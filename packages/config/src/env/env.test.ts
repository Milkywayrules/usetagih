import { expect, test } from "bun:test";
import { DEV_ENV_DEFAULTS, parseEnv } from "./schema";

test("prod rejects missing DATABASE_URL", () => {
  expect(() =>
    parseEnv("prod", {
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
    })
  ).toThrow();
});

test("prod rejects missing USETAGIH_API_PUBLIC_URL", () => {
  expect(() => parseEnv("prod", { DATABASE_URL: "postgresql://x" })).toThrow();
});

test("prod rejects empty DATABASE_URL", () => {
  expect(() =>
    parseEnv("prod", {
      DATABASE_URL: "",
      USETAGIH_API_PUBLIC_URL: "https://api.example.com",
    })
  ).toThrow();
});

test("staging rejects missing vars", () => {
  expect(() => parseEnv("staging", {})).toThrow();
});

test("dev accepts empty input with defaults", () => {
  expect(parseEnv("dev", {})).toEqual({
    DATABASE_URL: DEV_ENV_DEFAULTS.DATABASE_URL,
    USETAGIH_API_PUBLIC_URL: DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL,
  });
});

test("dev accepts overrides", () => {
  expect(
    parseEnv("dev", {
      DATABASE_URL: "postgresql://custom",
      USETAGIH_API_PUBLIC_URL: "http://127.0.0.1:3001",
    })
  ).toEqual({
    DATABASE_URL: "postgresql://custom",
    USETAGIH_API_PUBLIC_URL: "http://127.0.0.1:3001",
  });
});
