// @ts-nocheck — Elysia macros from composed plugins are runtime-valid but not inferred on child instances.
import type { WorkspaceSettingsRepo } from "@usetagih/db";
import {
	buildWorkspaceUploadedLogoUrl,
	ingestLogoFromBytes,
	type MemoryLogoBlobStore,
} from "@usetagih/render";
import { VALIDATION_FAILED_CODE, zodIssuesToDetails } from "@usetagih/schema";
import { Elysia } from "elysia";
import { statusApiError } from "../../lib/api-error.js";
import { getRequestId } from "../../middleware/request-id.js";
import {
	UpdateBrandingBodySchema,
	UpdateBusinessIdentityBodySchema,
} from "./settings.schemas.js";

export function createSettingsRoutes(deps: {
	workspaceSettingsRepo: WorkspaceSettingsRepo;
	logoBlobStore: MemoryLogoBlobStore;
	apiPublicUrl: string;
}) {
	return new Elysia()
		.patch(
			"/settings/business",
			async ({ body, request, status, set, workspaceId }) => {
				const requestId = getRequestId(request);
				const parsed = UpdateBusinessIdentityBodySchema.safeParse(body);
				if (!parsed.success) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: zodIssuesToDetails(parsed.error),
					});
				}

				if (Object.keys(parsed.data).length === 0) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: [
							{
								path: "/",
								code: VALIDATION_FAILED_CODE,
								message: "at least one field is required",
							},
						],
					});
				}

				const businessIdentity =
					await deps.workspaceSettingsRepo.updateBusinessIdentity(
						workspaceId,
						parsed.data,
					);

				return { businessIdentity };
			},
			{ authenticated: true, requireScope: "settings:write" } as never,
		)
		.patch(
			"/settings/branding",
			async ({ body, request, status, set, workspaceId }) => {
				const requestId = getRequestId(request);
				const parsed = UpdateBrandingBodySchema.safeParse(body);
				if (!parsed.success) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: zodIssuesToDetails(parsed.error),
					});
				}

				if (Object.keys(parsed.data).length === 0) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: [
							{
								path: "/",
								code: VALIDATION_FAILED_CODE,
								message: "at least one field is required",
							},
						],
					});
				}

				const branding = await deps.workspaceSettingsRepo.updateBranding(
					workspaceId,
					parsed.data,
				);

				return { branding };
			},
			{ authenticated: true, requireScope: "settings:write" } as never,
		)
		.post(
			"/settings/branding/logo",
			async ({ request, status, set, workspaceId }) => {
				const requestId = getRequestId(request);
				let formData: FormData;
				try {
					formData = await request.formData();
				} catch {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: [
							{
								path: "/logo",
								code: VALIDATION_FAILED_CODE,
								message: "multipart form with logo field is required",
							},
						],
					});
				}

				const file = formData.get("logo");
				if (!(file instanceof File)) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: [
							{
								path: "/logo",
								code: VALIDATION_FAILED_CODE,
								message: "logo file is required",
							},
						],
					});
				}

				const bytes = Buffer.from(await file.arrayBuffer());
				const ingested = await ingestLogoFromBytes(bytes, workspaceId);
				if (!ingested.ok) {
					return statusApiError(status, set, {
						code: VALIDATION_FAILED_CODE,
						message: "Request validation failed",
						requestId,
						details: [
							{
								path: "/logo",
								code: VALIDATION_FAILED_CODE,
								message: ingested.reason,
							},
						],
					});
				}

				const logoUrl = buildWorkspaceUploadedLogoUrl(
					deps.apiPublicUrl,
					workspaceId,
					ingested.logo.logoChecksum,
				);

				deps.logoBlobStore.putWithUrl({
					workspaceId,
					logoUrl,
					logo: ingested.logo,
				});

				const branding = await deps.workspaceSettingsRepo.updateBranding(
					workspaceId,
					{ logoUrl },
				);

				return status(201, {
					logoUrl,
					logoChecksum: ingested.logo.logoChecksum,
					contentType: ingested.logo.contentType,
					branding,
				});
			},
			{ authenticated: true, requireScope: "settings:write" } as never,
		);
}
