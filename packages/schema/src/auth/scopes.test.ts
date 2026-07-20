import { expect, test } from "bun:test";
import {
	API_SCOPES,
	ROUTE_SCOPE_REQUIREMENTS,
	SESSION_TOKEN_SCOPES,
} from "./scopes.js";

test("API_SCOPES matches canonical enum", () => {
	expect([...API_SCOPES]).toEqual([
		"renders:read",
		"renders:write",
		"webhooks:manage",
		"audit:read",
	]);
});

test("SESSION_TOKEN_SCOPES grants all four scopes", () => {
	expect(SESSION_TOKEN_SCOPES).toEqual([...API_SCOPES]);
});

test("ROUTE_SCOPE_REQUIREMENTS keys cover parity matrix stubs", () => {
	expect(Object.keys(ROUTE_SCOPE_REQUIREMENTS)).toContain("GET /v1/renders");
	expect(Object.keys(ROUTE_SCOPE_REQUIREMENTS)).toContain("POST /v1/webhooks");
});
