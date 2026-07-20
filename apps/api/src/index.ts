import { createApp } from "./app.js";
import { parseApiEnv } from "./env.js";

const env = parseApiEnv();
const port = Number(process.env.PORT ?? 3001);

const app = createApp({ env });
app.listen(port);

console.log(`@usetagih/api listening on ${env.USETAGIH_API_PUBLIC_URL}`);
