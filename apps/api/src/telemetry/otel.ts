import { opentelemetry, setAttributes } from "@elysiajs/opentelemetry";
import { trace } from "@opentelemetry/api";
import type { AnyElysia } from "elysia";
import { Elysia as ElysiaFactory } from "elysia";
import type { ApiEnv } from "../env.js";

const REDACTED = "[REDACTED]";
const SENSITIVE_SPAN_ATTRIBUTES = [
	"http.request.header.authorization",
	"http.request.header.cookie",
	"http.request.cookie",
] as const;

export type OtelSetup = {
	wrapApp: (app: AnyElysia) => AnyElysia;
	shutdown: () => Promise<void>;
};

function redactSensitiveSpanAttributes() {
	for (const key of SENSITIVE_SPAN_ATTRIBUTES) {
		setAttributes({ [key]: REDACTED });
	}
}

export function createOtelRequestIdPlugin() {
	return new ElysiaFactory({ name: "otel-request-id" })
		.onBeforeHandle({ as: "global" }, ({ store }) => {
			const requestId = (store as { requestId?: string }).requestId;
			if (requestId) {
				setAttributes({
					requestId,
					"request.id": requestId,
				});
			}
		})
		.onAfterHandle({ as: "global" }, () => {
			redactSensitiveSpanAttributes();
		});
}

export function initOtel(env: ApiEnv): OtelSetup {
	if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
		return {
			wrapApp: (app) => app,
			shutdown: async () => {},
		};
	}

	process.env.OTEL_EXPORTER_OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT;
	process.env.OTEL_SERVICE_NAME = "usetagih-api";

	const tracingPlugin = opentelemetry({
		serviceName: "usetagih-api",
	});

	return {
		wrapApp: (app) =>
			new ElysiaFactory().use(tracingPlugin).use(app) as AnyElysia,
		shutdown: async () => {
			const provider = trace.getTracerProvider();
			if (
				"forceFlush" in provider &&
				typeof provider.forceFlush === "function"
			) {
				await provider.forceFlush();
			}
			if ("shutdown" in provider && typeof provider.shutdown === "function") {
				await provider.shutdown();
			}
		},
	};
}
