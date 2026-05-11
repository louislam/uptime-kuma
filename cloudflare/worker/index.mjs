import { Container, ContainerProxy, getContainer } from "@cloudflare/containers";
import { consumeQueue, enqueueDueMonitors, handleApiRequest } from "./api.mjs";

export { ContainerProxy };

export class MonitorRunner extends Container {
    defaultPort = 8788;
    sleepAfter = "10m";
    enableInternet = true;
    pingEndpoint = "localhost:8788/health";
    entrypoint = ["node", "server.js"];

    constructor(ctx, env) {
        super(ctx, env);
        this.envVars = {
            PORT: "8788",
            TWINGATE_PROXY_URL: env.TWINGATE_PROXY_URL || "http://127.0.0.1:9999",
        };

        if (env.TWINGATE_SERVICE_KEY_B64) {
            this.envVars.TWINGATE_SERVICE_KEY_B64 = env.TWINGATE_SERVICE_KEY_B64;
        }
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
            return await handleApiRequest(request, env);
        }

        const runner = getContainer(env.RUNNER, "default");
        return await runner.fetch(request);
    },

    async scheduled(_controller, env, _ctx) {
        await enqueueDueMonitors(env);
    },

    async queue(batch, env) {
        await consumeQueue(batch, env);
    },
};
