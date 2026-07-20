import { beforeAll, describe, expect, test } from "bun:test";
import { parseEnv } from "@usetagih/config/env";
import { ApiErrorEnvelopeSchema } from "@usetagih/schema";
import { createApp } from "../../app.js";
import { signSessionBearerToken } from "../../auth/session-token.js";
import {
	createInMemoryApiKeyRepo,
	createTestApiKey,
} from "../../test-helpers/api-key.js";
import { createInMemoryAuditRepo } from "../../test-helpers/audit.js";
import { initTestLogger } from "../../test-helpers/evlog.js";

initTestLogger();

const env = parseEnv("dev", { USETAGIH_DOCS_ENABLED: "false" });
const RESOLVE_AUDIT_USER_ID = async () =>
	"00000000-0000-4000-8000-000000000001";

describe("GET /v1/audit", () => {
	let app: ReturnType<typeof createApp>;
	const apiKeyRepo = createInMemoryApiKeyRepo();
	const auditRepo = createInMemoryAuditRepo();

	beforeAll(() => {
		app = createApp({
			env,
			apiKeyRepo,
			auditRepo,
			otelEnabled: false,
			resolveAuditUserId: RESOLVE_AUDIT_USER_ID,
		});
	});

	test("returns paginated audit events for workspace with audit:read scope", async () => {
		const workspaceId = crypto.randomUUID();
		const actorUserId = "00000000-0000-4000-8000-000000000001";

		await auditRepo.append({
			workspaceId,
			userId: actorUserId,
			action: "validate",
			resourceType: "document",
			resourceId: "invoice",
			outcome: "success",
			ip: "203.0.113.1",
		});
		const downloadEvent = await auditRepo.append({
			workspaceId,
			userId: actorUserId,
			action: "render.download",
			resourceType: "render",
			resourceId: "rnd_00000000-0000-4000-8000-000000000099",
			outcome: "success",
		});
		const downloadRow = auditRepo.events.find(
			(event) => event.id === downloadEvent.id,
		);
		if (downloadRow) {
			downloadRow.createdAt = new Date(Date.now() + 1);
		}

		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["audit:read"],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/audit?page=1&pageSize=10", {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.page).toBe(1);
		expect(body.pageSize).toBe(10);
		expect(body.total).toBe(2);
		expect(body.events).toHaveLength(2);
		expect(body.events[0]?.action).toBe("render.download");
		expect(body.events[0]?.actorUserId).toBe(actorUserId);
		expect(body.events[0]?.ip).toBeNull();
		expect(body.events[1]?.action).toBe("validate");
		expect(body.events[1]?.ip).toBe("203.0.113.1");
	});

	test("renders:write scope without audit:read → 403", async () => {
		const workspaceId = crypto.randomUUID();
		const { secret } = await createTestApiKey(apiKeyRepo, {
			workspaceId,
			scopes: ["renders:write"],
		});

		const response = await app.handle(
			new Request("http://localhost/v1/audit", {
				headers: { Authorization: `Bearer ${secret}` },
			}),
		);

		expect(response.status).toBe(403);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("FORBIDDEN");
	});

	test("invalid pageSize → 422 VALIDATION_FAILED", async () => {
		const workspaceId = crypto.randomUUID();
		const signed = await signSessionBearerToken(
			{ userId: crypto.randomUUID(), workspaceId },
			env,
		);

		const response = await app.handle(
			new Request("http://localhost/v1/audit?pageSize=0", {
				headers: { Authorization: `Bearer ${signed.accessToken}` },
			}),
		);

		expect(response.status).toBe(422);
		const body = ApiErrorEnvelopeSchema.parse(await response.json());
		expect(body.error.code).toBe("VALIDATION_FAILED");
	});

	test("append-only repo exposes no delete/update methods", () => {
		const repo = createInMemoryAuditRepo();
		expect(typeof repo.append).toBe("function");
		expect(typeof repo.listByWorkspacePaginated).toBe("function");
		expect("delete" in repo).toBe(false);
		expect("update" in repo).toBe(false);
	});
});
