import { type ElysiaOpenAPIConfig, openapi } from "@elysiajs/openapi";
import {
	CURRENT_SCHEMA_VERSION,
	generateOpenApiComponents,
} from "@usetagih/schema";
import { Elysia } from "elysia";
import type { OpenAPIV3 } from "openapi-types";
import type { ApiEnv } from "../env.js";

function mergeSchemaComponents() {
	const generated = generateOpenApiComponents() as {
		components?: Record<string, unknown>;
		schemas?: Record<string, unknown>;
	};
	if (generated.components) {
		return generated.components;
	}
	return { schemas: generated.schemas ?? generated };
}

function buildDocumentation(): OpenAPIV3.Document & Record<string, unknown> {
	return {
		openapi: "3.1.0",
		info: {
			title: "usetagih API",
			version: CURRENT_SCHEMA_VERSION,
			description:
				"Partial OpenAPI specification — route coverage incomplete until Story 7.4.",
		},
		paths: {},
		"x-usetagih-spec-maturity": "partial",
		components: mergeSchemaComponents(),
	};
}

export function createOpenapiDocsPlugin(env: ApiEnv) {
	if (!env.USETAGIH_DOCS_ENABLED) {
		return new Elysia({ name: "openapi-docs-disabled" })
			.get("/v1/openapi.json", ({ set }) => {
				set.status = 404;
				return null;
			})
			.get("/docs", ({ set }) => {
				set.status = 404;
				return null;
			});
	}

	return new Elysia({ name: "openapi-docs" }).use(
		openapi({
			path: "/docs",
			specPath: "/v1/openapi.json",
			provider: "scalar",
			documentation:
				buildDocumentation() as ElysiaOpenAPIConfig["documentation"],
		}),
	);
}
