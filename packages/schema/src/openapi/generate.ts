import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { openApiRegistry } from "./registry.js";

const MONEY_AMOUNT_PATTERN = "^(?:0|[1-9]\\d*)(?:\\.\\d+)?$";

export function generateOpenApiComponents(): Record<string, unknown> {
	const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);
	return generator.generateComponents() as Record<string, unknown>;
}

/** Exported for structural tests — same function build script uses. */
export { MONEY_AMOUNT_PATTERN };

async function writeComponentsArtifact(): Promise<void> {
	const components = generateOpenApiComponents();
	const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
	const outPath = join(packageRoot, "openapi/components.json");
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, `${JSON.stringify(components, null, 2)}\n`, "utf8");
}

const isDirectExecution =
	import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
	await writeComponentsArtifact();
}
