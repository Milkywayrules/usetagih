/** Stable HTTPS logoUrl stored after upload; indexed in LogoBlobStore via putWithUrl. */
export function buildWorkspaceUploadedLogoUrl(
	apiPublicUrl: string,
	workspaceId: string,
	logoChecksum: string,
): string {
	const base = apiPublicUrl.replace(/\/$/, "");
	return `${base}/v1/settings/branding/logo/${workspaceId}/${logoChecksum}`;
}
