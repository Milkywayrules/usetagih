import type { RenderRecord } from "../ports/index.js";
import { formatRenderId } from "../render-id.js";

export type RenderMetadata = {
	renderId: string;
	status: RenderRecord["status"];
	documentType: string;
	template: string;
	schemaVersion: string;
	shareUrl: string | null;
	expiresAt: string | null;
	idempotencyFingerprint: string | null;
	createdAt: string;
	updatedAt: string;
};

export function mapRenderRecordToMetadata(
	record: RenderRecord,
	webPublicUrl: string,
): RenderMetadata {
	const baseUrl = webPublicUrl.replace(/\/$/, "");
	const shareUrl =
		record.shareToken != null ? `${baseUrl}/share/${record.shareToken}` : null;

	return {
		renderId: formatRenderId(record.id),
		status: record.status,
		documentType: record.documentType,
		template: record.template,
		schemaVersion: record.schemaVersion,
		shareUrl,
		expiresAt: record.shareExpiresAt?.toISOString() ?? null,
		idempotencyFingerprint: record.idempotencyHash ?? null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}
