/**
 * Integration tests for validate endpoints.
 * Skipped when compose Postgres is unreachable (probeDb false).
 */
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	setDefaultTimeout,
	test,
} from "bun:test";
import { createDb, probeDb } from "@usetagih/db";
import invoiceMinimal from "../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import receiptMinimal from "../../../../packages/schema/__fixtures__/valid/receipt-minimal.json";
import { createApp } from "../app.js";
import { initTestLogger } from "../test-helpers/evlog.js";

initTestLogger();

const postgresUp = await probeDb();
if (postgresUp) setDefaultTimeout(15_000);
const describeIntegration = postgresUp ? describe : describe.skip;

class AuthCookieJar {
	private readonly cookies = new Map<string, string>();

	absorb(response: Response) {
		for (const line of response.headers.getSetCookie()) {
			const pair = line.split(";")[0];
			const separator = pair?.indexOf("=");
			if (pair && separator != null && separator > 0) {
				this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
			}
		}
	}

	headers(extra: Record<string, string> = {}): Record<string, string> {
		const headers = { ...extra };
		if (this.cookies.size > 0) {
			headers.cookie = [...this.cookies.entries()]
				.map(([name, value]) => `${name}=${value}`)
				.join("; ");
		}
		return headers;
	}
}

function suffix() {
	return crypto.randomUUID().slice(0, 8);
}

const validateIntegrationCases = [
	{
		path: "/v1/invoices/validate",
		fixture: invoiceMinimal,
		documentType: "invoice" as const,
	},
	{
		path: "/v1/quotations/validate",
		fixture: quotationMinimal,
		documentType: "quotation" as const,
	},
	{
		path: "/v1/receipts/validate",
		fixture: receiptMinimal,
		documentType: "receipt" as const,
	},
] as const;

describeIntegration("validate integration", () => {
	let app: ReturnType<typeof createApp>;
	let base: string;
	const { db, sql } = createDb();
	const jar = new AuthCookieJar();

	beforeAll(() => {
		app = createApp({ db });
		app.listen(0);
		const port = app.server?.port ?? 0;
		base = `http://127.0.0.1:${port}`;
	});

	afterAll(async () => {
		app.stop();
		await sql.end({ timeout: 1 });
	});

	async function signUpAndCreateApiKey(id: string) {
		const signup = await fetch(`${base}/api/auth/sign-up-with-workspace`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: `validate-${id}@example.com`,
				password: "password123",
				name: "Validate User",
				workspaceName: `Workspace ${id}`,
				workspaceSlug: `ws-${id}`,
			}),
		});
		jar.absorb(signup);
		expect(signup.status).toBe(200);

		const createKey = await fetch(`${base}/v1/api-keys`, {
			method: "POST",
			headers: jar.headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				name: "Validate key",
				scopes: ["renders:write"],
			}),
		});
		expect(createKey.status).toBe(201);
		const created = (await createKey.json()) as { secret: string };
		return created.secret;
	}

	for (const row of validateIntegrationCases) {
		test(`API key ${row.path} valid minimal fixture → 200 normalizedPreview`, async () => {
			const id = suffix();
			const apiKey = await signUpAndCreateApiKey(id);

			const response = await fetch(`${base}${row.path}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(row.fixture),
			});

			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				valid: boolean;
				normalizedPreview: { documentType: string; schemaVersion: string };
			};
			expect(body.valid).toBe(true);
			expect(body.normalizedPreview.documentType).toBe(row.documentType);
			expect(body.normalizedPreview.schemaVersion).toBe("2026-07-20");
		});
	}
});
