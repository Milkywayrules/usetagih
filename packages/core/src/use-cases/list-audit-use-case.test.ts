import { describe, expect, test } from "bun:test";
import type { AuditEventRecord, AuditRepo } from "../ports/index.js";
import {
	AUDIT_RETENTION_DAYS,
	listAuditUseCase,
	mapAuditEventRecord,
} from "./list-audit-use-case.js";

function sampleEvent(
	overrides: Partial<AuditEventRecord> = {},
): AuditEventRecord {
	return {
		id: crypto.randomUUID(),
		workspaceId: "00000000-0000-4000-8000-000000000010",
		userId: "00000000-0000-4000-8000-000000000001",
		action: "validate",
		resourceType: "document",
		resourceId: "invoice",
		outcome: "success",
		ip: "127.0.0.1",
		metadata: null,
		createdAt: new Date("2026-07-20T00:00:00.000Z"),
		...overrides,
	};
}

describe("listAuditUseCase", () => {
	test("returns paginated events within retention window", async () => {
		const now = new Date("2026-07-20T12:00:00.000Z");
		const workspaceId = "00000000-0000-4000-8000-000000000010";
		let capturedSince: Date | undefined;

		const auditRepo: AuditRepo = {
			async append() {
				throw new Error("not used");
			},
			async listByWorkspacePaginated(id, query) {
				expect(id).toBe(workspaceId);
				expect(query.limit).toBe(20);
				expect(query.offset).toBe(0);
				capturedSince = query.since;
				return {
					items: [sampleEvent({ workspaceId })],
					total: 1,
				};
			},
		};

		const result = await listAuditUseCase({ workspaceId, now }, auditRepo);

		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
		expect(result.total).toBe(1);
		expect(result.events).toHaveLength(1);
		expect(result.events[0]?.action).toBe("validate");

		const expectedSince = new Date(now);
		expectedSince.setUTCDate(expectedSince.getUTCDate() - AUDIT_RETENTION_DAYS);
		expect(capturedSince?.toISOString()).toBe(expectedSince.toISOString());
	});

	test("caps pageSize at 100", async () => {
		const auditRepo: AuditRepo = {
			async append() {
				throw new Error("not used");
			},
			async listByWorkspacePaginated(_id, query) {
				expect(query.limit).toBe(100);
				expect(query.offset).toBe(100);
				return { items: [], total: 0 };
			},
		};

		const result = await listAuditUseCase(
			{
				workspaceId: "00000000-0000-4000-8000-000000000010",
				page: 2,
				pageSize: 500,
			},
			auditRepo,
		);

		expect(result.pageSize).toBe(100);
	});
});

describe("mapAuditEventRecord", () => {
	test("maps createdAt to ISO string", () => {
		const mapped = mapAuditEventRecord(sampleEvent());
		expect(mapped.createdAt).toBe("2026-07-20T00:00:00.000Z");
		expect(mapped.actorUserId).toBe("00000000-0000-4000-8000-000000000001");
	});
});
