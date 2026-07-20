import { getSchemaMetadata } from "@usetagih/schema";
import { Elysia } from "elysia";

export function createSchemasRoutes() {
	return new Elysia({ name: "schemas" }).get("/schemas", () =>
		getSchemaMetadata(),
	);
}
