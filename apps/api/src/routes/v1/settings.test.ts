import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { mergeBranding } from "@usetagih/core";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import { createApp } from "../../app.js";
import { signSessionBearerToken } from "../../auth/session-token.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { createInMemoryAuditRepo } from "../../test-helpers/audit.js";
import { initTestLogger } from "../../test-helpers/evlog.js";
import { createInMemoryWorkspaceSettingsRepo } from "../../test-helpers/workspace-settings.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("workspace settings routes", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();
	const auditRepo = createInMemoryAuditRepo();
	const workspaceSettingsRepo = createInMemoryWorkspaceSettingsRepo();

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			auditRepo,
			workspaceSettingsRepo,
			otelEnabled: false,
			resolveAuditUserId: async () => "00000000-0000-4000-8000-000000000001",
		});
	});

	test("merge precedence: payload branding overrides workspace default", () => {
		const merged = mergeBranding(
			{
				logoUrl: "https://workspace.example/logo.png",
				accentColor: "#111111",
			},
			{ logoUrl: "https://payload.example/logo.png" },
		);
		expect(merged.logoUrl).toBe("https://payload.example/logo.png");
		expect(merged.accentColor).toBe("#111111");
	});

	test("PATCH /v1/settings/business persists business identity", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["settings:write"],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/settings/business", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: "Acme Corp",
					email: "billing@acme.example",
					taxId: "TAX-123",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.businessIdentity.name).toBe("Acme Corp");
		expect(body.businessIdentity.email).toBe("billing@acme.example");

		const stored =
			await workspaceSettingsRepo.getFullByOrganizationId(workspaceId);
		expect(stored?.businessIdentity?.name).toBe("Acme Corp");
	});

	test("PATCH /v1/settings/branding persists accent color and logoUrl", async () => {
		const workspaceId = crypto.randomUUID();
		const signed = await signSessionBearerToken(
			{ userId: crypto.randomUUID(), workspaceId },
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/settings/branding", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${signed.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					accentColor: "#aabbcc",
					logoUrl: "https://cdn.example/logo.png",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.branding.accentColor).toBe("#aabbcc");
		expect(body.branding.logoUrl).toBe("https://cdn.example/logo.png");
	});

	test("POST /v1/settings/branding/logo ingests PNG and updates branding", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["settings:write"],
		});

		const form = new FormData();
		form.append(
			"logo",
			new File([PNG_BYTES], "logo.png", { type: "image/png" }),
		);

		const response = await app.handle(
			new Request("http://localhost/v1/settings/branding/logo", {
				method: "POST",
				headers: { Authorization: `Bearer ${secret}` },
				body: form,
			}),
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.logoChecksum).toMatch(/^[a-f0-9]{64}$/);
		expect(body.logoUrl).toContain(workspaceId);
		expect(body.branding.logoUrl).toBe(body.logoUrl);
	});

	test("POST /v1/settings/branding/logo rejects oversize upload", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["settings:write"],
		});

		const oversized = new Uint8Array(2_097_153);
		oversized[0] = 0x89;
		oversized[1] = 0x50;
		const form = new FormData();
		form.append(
			"logo",
			new File([oversized], "big.png", { type: "image/png" }),
		);

		const response = await app.handle(
			new Request("http://localhost/v1/settings/branding/logo", {
				method: "POST",
				headers: { Authorization: `Bearer ${secret}` },
				body: form,
			}),
		);

		expect(response.status).toBe(422);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("VALIDATION_FAILED");
	});

	test("renders:write scope without settings:write → 403 on PATCH branding", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["renders:write"],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/settings/branding", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${secret}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ accentColor: "#000000" }),
			}),
		);

		expect(response.status).toBe(403);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("FORBIDDEN");
	});
});
