import { initLogger } from "evlog";
import { createApp } from "./app.js";
import { parseApiEnv } from "./env.js";
import { initOtel } from "./telemetry/otel.js";

initLogger({ env: { service: "usetagih-api" } });

const env = parseApiEnv();
const port = Number(process.env.PORT ?? 3001);
const otel = initOtel(env);

const app = otel.wrapApp(createApp({ env }));
app.listen(port);

console.log(`@usetagih/api listening on ${env.USETAGIH_API_PUBLIC_URL}`);

async function shutdown(signal: string) {
	console.log(`@usetagih/api received ${signal}, flushing telemetry`);
	await otel.shutdown();
	process.exit(0);
}

process.on("SIGTERM", () => {
	void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
	void shutdown("SIGINT");
});
