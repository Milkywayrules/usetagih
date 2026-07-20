import { expect, test } from "bun:test";
import { isBlockedHostname, isBlockedIpAddress } from "./private-ip.js";

test("blocks RFC1918 and metadata IPv4 addresses", () => {
	expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
	expect(isBlockedIpAddress("10.0.0.1")).toBe(true);
	expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
	expect(isBlockedIpAddress("192.168.1.1")).toBe(true);
	expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
	expect(isBlockedIpAddress("100.64.0.1")).toBe(true);
	expect(isBlockedIpAddress("0.0.0.1")).toBe(true);
});

test("allows public IPv4 addresses", () => {
	expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
	expect(isBlockedIpAddress("1.1.1.1")).toBe(false);
});

test("blocks IPv6 loopback, ULA, and link-local", () => {
	expect(isBlockedIpAddress("::1")).toBe(true);
	expect(isBlockedIpAddress("fc00::1")).toBe(true);
	expect(isBlockedIpAddress("fe80::1")).toBe(true);
});

test("blocks IP literal hostnames", () => {
	expect(isBlockedHostname("127.0.0.1")).toBe(true);
	expect(isBlockedHostname("example.com")).toBe(false);
});
