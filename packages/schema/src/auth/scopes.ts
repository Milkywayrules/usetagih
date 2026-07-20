import { z } from "zod";

export const API_SCOPES = [
	"renders:read",
	"renders:write",
	"webhooks:manage",
	"audit:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const ApiScopeSchema = z.enum(API_SCOPES);

export const ApiScopeArraySchema = z.array(ApiScopeSchema).min(1);

/** Session token exchange grants full workspace access (all scopes). Story 3.5 API keys may subset. */
export const SESSION_TOKEN_SCOPES: readonly ApiScope[] = [...API_SCOPES];

/** Route → required scope(s) — single source for parity matrix (3.4 session side; 3.5 adds api_key column). */
export const ROUTE_SCOPE_REQUIREMENTS = {
	"GET /v1/renders": ["renders:read"],
	"POST /v1/renders": ["renders:write"],
	"POST /v1/invoices/validate": ["renders:write"],
	"POST /v1/quotations/validate": ["renders:write"],
	"POST /v1/receipts/validate": ["renders:write"],
	"POST /v1/invoices/preview": ["renders:write"],
	"POST /v1/quotations/preview": ["renders:write"],
	"POST /v1/receipts/preview": ["renders:write"],
	"POST /v1/invoices/render": ["renders:write"],
	"POST /v1/quotations/render": ["renders:write"],
	"POST /v1/receipts/render": ["renders:write"],
	"GET /v1/audit": ["audit:read"],
	"POST /v1/webhooks": ["webhooks:manage"],
	"GET /v1/webhooks": ["webhooks:manage"],
	"DELETE /v1/webhooks/:id": ["webhooks:manage"],
} as const satisfies Record<string, readonly ApiScope[]>;
