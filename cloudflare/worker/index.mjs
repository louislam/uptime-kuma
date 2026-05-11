import { Container, ContainerProxy, getContainer } from "@cloudflare/containers";
import { consumeQueue, enqueueDueMonitors, handleApiRequest } from "./api.mjs";

export { ContainerProxy };

export class MonitorRunner extends Container {
    defaultPort = 8788;
    sleepAfter = "10m";
    enableInternet = true;
    pingEndpoint = "localhost:8788/health";
    entrypoint = ["node", "server.js"];

    /**
     * Configure container runtime environment variables.
     * @param {DurableObjectState} ctx Durable Object state.
     * @param {object} env Cloudflare Worker environment bindings.
     */
    constructor(ctx, env) {
        super(ctx, env);
        this.envVars = {
            PORT: "8788",
        };

        copyOptionalEnv(this.envVars, env, [
            "TWINGATE_SERVICE_KEY_B64",
            "TWINGATE_SERVICE_KEY_JSON",
            "TWINGATE_SERVICE_KEY_VERSION",
            "TWINGATE_NETWORK",
            "TWINGATE_SERVICE_ACCOUNT_ID",
            "TWINGATE_PRIVATE_KEY",
            "TWINGATE_PRIVATE_KEY_B64",
            "TWINGATE_KEY_ID",
            "TWINGATE_EXPIRES_AT",
            "TWINGATE_LOGIN_PATH",
        ]);
    }
}

/**
 * Copy optional Worker bindings into the container environment.
 * @param {object} target Container environment variable map.
 * @param {object} source Worker environment bindings.
 * @param {string[]} names Binding names to copy when present.
 * @returns {void}
 */
function copyOptionalEnv(target, source, names) {
    for (const name of names) {
        if (source[name]) {
            target[name] = source[name];
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
