import { isIPv4, isIPv6 } from "node:net";

/** Returns true when the address must be blocked for SSRF (RFC1918, loopback, link-local, CGNAT, etc.). */
export function isBlockedIpAddress(address: string): boolean {
	if (isIPv4(address)) {
		return isBlockedIpv4(address);
	}
	if (isIPv6(address)) {
		return isBlockedIpv6(address);
	}
	return true;
}

function parseIpv4Octets(address: string): number[] | null {
	const parts = address.split(".");
	if (parts.length !== 4) {
		return null;
	}
	const octets: number[] = [];
	for (const part of parts) {
		const value = Number(part);
		if (!Number.isInteger(value) || value < 0 || value > 255) {
			return null;
		}
		octets.push(value);
	}
	return octets;
}

function isBlockedIpv4(address: string): boolean {
	const octets = parseIpv4Octets(address);
	if (!octets) {
		return true;
	}
	const [a, b] = octets;

	if (a === 127) return true;
	if (a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 169 && b === 254) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 0) return true;

	return false;
}

function expandIpv6(address: string): bigint | null {
	const lower = address.toLowerCase();
	let head = lower;
	const zoneIndex = lower.indexOf("%");
	if (zoneIndex >= 0) {
		head = lower.slice(0, zoneIndex);
	}

	const split = head.split("::");
	if (split.length > 2) {
		return null;
	}

	let headParts: string[] = [];
	let tailParts: string[] = [];
	if (split.length === 1) {
		headParts = split[0] === "" ? [] : split[0].split(":");
	} else {
		headParts = split[0] === "" ? [] : split[0].split(":");
		tailParts = split[1] === "" ? [] : split[1].split(":");
	}

	const missing = 8 - (headParts.length + tailParts.length);
	if (missing < 0) {
		return null;
	}

	const parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
	if (parts.length !== 8) {
		return null;
	}

	let value = 0n;
	for (const part of parts) {
		if (part.length === 0 || part.length > 4) {
			return null;
		}
		const segment = BigInt(`0x${part}`);
		if (segment > 0xffffn) {
			return null;
		}
		value = (value << 16n) | segment;
	}

	return value;
}

function isBlockedIpv6(address: string): boolean {
	const value = expandIpv6(address);
	if (value === null) {
		return true;
	}

	if (value === 1n) return true;

	const top7 = Number(value >> 121n);
	if (top7 === 0x7e) return true;

	const top10 = Number(value >> 118n);
	if (top10 === 0x3fa) return true;

	return false;
}

/** Hostname literals that parse as IP addresses — apply SSRF blocklist without DNS. */
export function isBlockedHostname(hostname: string): boolean {
	const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "");
	if (!isIPv4(normalized) && !isIPv6(normalized)) {
		return false;
	}
	return isBlockedIpAddress(normalized);
}
