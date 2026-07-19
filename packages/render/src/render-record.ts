import { createHash } from "node:crypto";

/**
 * Future Drizzle `renders.logo_checksum` (SOLUTION-DESIGN §4.4, epics Story 3.1).
 * SHA-256 hex of persisted logo bytes written for Typst — post-SVG-sanitization when applicable.
 * Populated by render pipeline from `prepareLogoForTypst().logoChecksum`; not persisted to DB in Epic 1.
 */
export function computeLogoChecksum(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Stub for future `renders` table logo fields — no DB wiring in Epic 1. */
export type RenderRecordLogoFields = {
	logo_checksum: string | null;
};
