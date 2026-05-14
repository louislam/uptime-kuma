import { Container, ContainerProxy, getContainer } from "@cloudflare/containers";
import { consumeQueue, enqueueDueMonitors, handleApiRequest } from "./api.mjs";

export { ContainerProxy };

const RUNNER_STATUS_STORAGE_KEY = "runner:twingate:last-unavailable-status";
const SYSTEM_TWINGATE_PROXY_URL = "http://127.0.0.1:9999";
const TWINGATE_ENV_INPUTS = [
    "TWINGATE_SERVICE_KEY_B64",
    "TWINGATE_SERVICE_KEY_JSON",
    "TWINGATE_PRIVATE_KEY",
    "TWINGATE_PRIVATE_KEY_B64",
    "TWINGATE_NETWORK",
    "TWINGATE_SERVICE_ACCOUNT_ID",
    "TWINGATE_KEY_ID",
];

export class MonitorRunner extends Container {
    defaultPort = 8788;
    sleepAfter = "10m";
    enableInternet = true;
    pingEndpoint = "localhost/health";
    entrypoint = ["node", "server.js"];

    /**
     * Configure container runtime environment variables.
     * @param {DurableObjectState} ctx Durable Object state.
     * @param {object} env Cloudflare Worker environment bindings.
     */
    constructor(ctx, env) {
        super(ctx, env);
        this.requiredPorts = [8788];
        this.envVars = {
            PORT: "8788",
            TWINGATE_READY_TIMEOUT_MS: "60000",
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
            "TWINGATE_READY_TIMEOUT_MS",
            "TWINGATE_TUN",
        ]);
    }

    /**
     * Return a JSON status payload when the runner cannot boot far enough to serve status itself.
     * @param {Request} request Incoming Durable Object request.
     * @returns {Promise<Response>} Runner response.
     */
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname !== "/twingate/status") {
            return await super.fetch(request);
        }

        try {
            const response = await super.fetch(request);
            if (response.ok) {
                return response;
            }

            const status = await this.persistUnavailableTwingateStatus(
                `Failed to start runner container: ${await response.text()}`
            );
            return Response.json(status);
        } catch (error) {
            const status = await this.persistUnavailableTwingateStatus(
                `Failed to start runner container: ${formatErrorMessage(error)}`
            );
            return Response.json(status);
        }
    }

    /**
     * Persist a sanitized status when the container stops.
     * @param {object} params Stop parameters from the Container runtime.
     * @param {number} params.exitCode Process exit code.
     * @param {string} params.reason Stop reason.
     * @returns {Promise<void>} Completion promise.
     */
    async onStop({ exitCode, reason }) {
        await this.persistUnavailableTwingateStatus(
            `Runner container stopped${exitCode === undefined ? "" : ` with exit code ${exitCode}`}${reason ? ` (${reason})` : ""}`
        );
    }

    /**
     * Persist startup errors while still letting Cloudflare fail the startup attempt.
     * @param {unknown} error Container startup error.
     * @returns {Promise<void>} Completion promise.
     */
    async onError(error) {
        await this.persistUnavailableTwingateStatus(`Runner container error: ${formatErrorMessage(error)}`);
        throw error;
    }

    /**
     * Store and return a sanitized unavailable Twingate status.
     * @param {string} lastError Sanitized startup failure.
     * @returns {Promise<object>} Status payload for the Worker API.
     */
    async persistUnavailableTwingateStatus(lastError) {
        const status = buildUnavailableTwingateStatus(this.env, lastError);
        await this.ctx.storage.put(RUNNER_STATUS_STORAGE_KEY, status);
        return status;
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
            target[name] = normalizeContainerEnvValue(source[name]);
        }
    }
}

function normalizeContainerEnvValue(value) {
    return typeof value === "object" ? JSON.stringify(value) : value;
}

function buildUnavailableTwingateStatus(env, lastError) {
    return {
        configured: TWINGATE_ENV_INPUTS.some((name) => Boolean(env?.[name])),
        starting: false,
        running: false,
        proxyUrl: SYSTEM_TWINGATE_PROXY_URL,
        tunMode: env?.TWINGATE_TUN || null,
        lastError,
    };
}

function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
            return await handleApiRequest(request, env);
        }

        return await env.ASSETS.fetch(request);
    },

    async scheduled(_controller, env, _ctx) {
        await enqueueDueMonitors(env);
    },

    async queue(batch, env) {
        await consumeQueue(batch, env);
    },
};
