import { Container, ContainerProxy } from "@cloudflare/containers";
import {
    checkTwingateHealthAlert,
    consumeQueue,
    enqueueDueMonitors,
    handleApiRequest,
    purgeOldMonitorHistory,
    resolveAppVersion,
} from "./api.mjs";
import {
    buildStartingTwingateStatus,
    buildUnavailableTwingateStatus,
    isTransientContainerStartupError,
    resolveTwingateStatusTimeoutMs,
} from "./twingate-status.mjs";

export { ContainerProxy };

const RUNNER_STATUS_STORAGE_KEY = "runner:twingate:last-unavailable-status";
const RUNNER_PORT = 8788;
const RUNNER_FETCH_MAX_RETRIES = 3;
const RUNNER_FETCH_RETRY_DELAY_MS = 250;

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
            APP_VERSION: resolveAppVersion(env),
            PORT: "8788",
            TWINGATE_READY_TIMEOUT_MS: "60000",
            TWINGATE_TUN: "off",
            TWINGATE_PING_FALLBACK_PORTS: "80,443",
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
            "TWINGATE_STATUS_REQUEST_TIMEOUT_MS",
            "TWINGATE_PING_FALLBACK_PORTS",
        ]);
    }

    /**
     * Return a JSON status payload when the runner cannot boot far enough to serve status itself.
     * @param {Request} request Incoming Durable Object request.
     * @returns {Promise<Response>} Runner response.
     */
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/twingate/status") {
            return await this.fetchTwingateStatus(request);
        }

        return await this.fetchRunnerRequest(request);
    }

    /**
     * Fetch the Twingate status endpoint while giving Cloudflare Containers a brief
     * window to attach a freshly-starting instance.
     * @param {Request} request Incoming Twingate status request.
     * @returns {Promise<Response>} Runner status response.
     */
    async fetchTwingateStatus(request) {
        let lastError = "";
        for (let attempt = 0; attempt <= RUNNER_FETCH_MAX_RETRIES; attempt++) {
            try {
                await this.startRunnerContainer();
                const response = await this.containerFetch(request, RUNNER_PORT);
                if (response.ok) {
                    return response;
                }

                lastError = `Failed to start runner container: ${await response.text()}`;
            } catch (error) {
                lastError = `Failed to start runner container: ${formatErrorMessage(error)}`;
            }

            if (!isTransientContainerStartupError(lastError)) {
                const status = await this.persistUnavailableTwingateStatus(lastError);
                return Response.json(status);
            }

            if (attempt < RUNNER_FETCH_MAX_RETRIES) {
                await delay(RUNNER_FETCH_RETRY_DELAY_MS);
            }
        }

        const status = await this.persistStartingTwingateStatus();
        return Response.json(status);
    }

    /**
     * Fetch a normal monitor-check request after explicitly waiting for the runner
     * port. The default Container fetch can surface cold-start races as 500s, which
     * should not be recorded as target downtime.
     * @param {Request} request Incoming runner request.
     * @returns {Promise<Response>} Runner response.
     */
    async fetchRunnerRequest(request) {
        let lastError = "";
        for (let attempt = 0; attempt <= RUNNER_FETCH_MAX_RETRIES; attempt++) {
            try {
                await this.startRunnerContainer();
                return await this.containerFetch(request, RUNNER_PORT);
            } catch (error) {
                lastError = `Failed to start runner container: ${formatErrorMessage(error)}`;
                if (!isTransientContainerStartupError(lastError)) {
                    await this.persistUnavailableTwingateStatus(lastError);
                    return Response.json({ error: lastError }, { status: 503 });
                }
            }

            if (attempt < RUNNER_FETCH_MAX_RETRIES) {
                await delay(RUNNER_FETCH_RETRY_DELAY_MS);
            }
        }

        const status = await this.persistStartingTwingateStatus();
        return Response.json({ error: status.lastError }, { status: 503 });
    }

    /**
     * Start the runner container and wait until the HTTP port is ready.
     * @returns {Promise<void>} Resolves when the runner is accepting requests.
     */
    async startRunnerContainer() {
        await this.startAndWaitForPorts({
            startOptions: {
                envVars: this.envVars,
                entrypoint: this.entrypoint,
                enableInternet: this.enableInternet,
            },
            ports: [RUNNER_PORT],
            cancellationOptions: {
                instanceGetTimeoutMS: resolveTwingateStatusTimeoutMs(this.env),
                portReadyTimeoutMS: resolveTwingateStatusTimeoutMs(this.env),
                waitInterval: RUNNER_FETCH_RETRY_DELAY_MS,
            },
        });
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

    /**
     * Store and return a sanitized starting Twingate status.
     * @returns {Promise<object>} Status payload for the Worker API.
     */
    async persistStartingTwingateStatus() {
        const status = buildStartingTwingateStatus(this.env);
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

function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        await purgeOldMonitorHistory(env);
        await checkTwingateHealthAlert(env);
    },

    async queue(batch, env) {
        await consumeQueue(batch, env);
    },
};
