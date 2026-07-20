const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatRenderId(uuid: string): string {
	return `rnd_${uuid}`;
}

export function parseRenderId(apiRenderId: string): string | null {
	const raw = apiRenderId.startsWith("rnd_")
		? apiRenderId.slice("rnd_".length)
		: apiRenderId;
	return UUID_PATTERN.test(raw) ? raw : null;
}
