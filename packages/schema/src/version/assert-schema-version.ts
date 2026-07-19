import { UNSUPPORTED_SCHEMA_VERSION_CODE } from "../errors/codes";
import type { SchemaVersion } from "./constants";
import { CURRENT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS } from "./constants";

export type UnsupportedSchemaVersionResult = {
	ok: false;
	code: typeof UNSUPPORTED_SCHEMA_VERSION_CODE;
	message: string;
	received: string;
	supportedVersions: readonly SchemaVersion[];
};

export type SchemaVersionAssertResult =
	| { ok: true; schemaVersion: SchemaVersion }
	| UnsupportedSchemaVersionResult;

export type NormalizeSchemaVersionResult =
	| { ok: true; normalized: Record<string, unknown> }
	| UnsupportedSchemaVersionResult;

function formatUnsupportedSchemaVersionMessage(
	received: string,
	supportedVersions: readonly SchemaVersion[],
): string {
	return `Unsupported schemaVersion "${received}". Supported versions: ${supportedVersions.join(", ")}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnsupportedSchemaVersion(
	received: unknown,
): UnsupportedSchemaVersionResult {
	const receivedLabel = String(received);
	return {
		ok: false,
		code: UNSUPPORTED_SCHEMA_VERSION_CODE,
		message: formatUnsupportedSchemaVersionMessage(
			receivedLabel,
			SUPPORTED_SCHEMA_VERSIONS,
		),
		received: receivedLabel,
		supportedVersions: SUPPORTED_SCHEMA_VERSIONS,
	};
}

export function assertSupportedSchemaVersion(
	value: unknown,
): SchemaVersionAssertResult {
	if (
		typeof value === "string" &&
		(SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(value)
	) {
		return { ok: true, schemaVersion: value as SchemaVersion };
	}

	return rejectUnsupportedSchemaVersion(value);
}

export function normalizePayloadSchemaVersion(
	raw: unknown,
): NormalizeSchemaVersionResult {
	if (!isPlainObject(raw)) {
		return { ok: true, normalized: raw as Record<string, unknown> };
	}

	if (raw.schemaVersion === undefined) {
		return {
			ok: true,
			normalized: {
				...raw,
				schemaVersion: CURRENT_SCHEMA_VERSION,
			},
		};
	}

	const asserted = assertSupportedSchemaVersion(raw.schemaVersion);
	if (!asserted.ok) {
		return asserted;
	}

	return {
		ok: true,
		normalized: {
			...raw,
			schemaVersion: asserted.schemaVersion,
		},
	};
}
