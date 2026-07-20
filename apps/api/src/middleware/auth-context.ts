import type { ApiScope } from "@usetagih/schema";

export type AuthContext = {
	authType: "session" | "session_bearer";
	userId: string;
	workspaceId: string;
	scopes: ApiScope[];
};

export function hasRequiredScopes(
	authContext: AuthContext,
	required: readonly ApiScope[],
): boolean {
	return required.every((scope) => authContext.scopes.includes(scope));
}
