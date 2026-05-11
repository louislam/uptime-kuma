/* eslint-disable jsdoc/require-jsdoc */
const fs = require("node:fs");
const net = require("node:net");
const childProcess = require("node:child_process");
const { SYSTEM_TWINGATE_PROXY_URL } = require("./checker");

const SERVICE_KEY_PATH = "/etc/twingate/service_key.json";
const TWINGATED_FILE = "/usr/sbin/twingated";
const TWINGATE_PROXY_LISTEN_ADDRESS = "0.0.0.0:9999";
const TWINGATE_PROXY_READY_HOST = "127.0.0.1";
const TWINGATE_PROXY_READY_PORT = 9999;
const DEFAULT_READY_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_CAPTURED_OUTPUT_LENGTH = 4000;

class TwingateLifecycle {
    constructor(options = {}) {
        this.serviceKey = options.serviceKey || { configured: false, missing: [] };
        this.fs = options.fs || fs;
        this.spawn = options.spawn || childProcess.spawn;
        this.waitForProxyReady = options.waitForProxyReady || waitForProxyReady;
        this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
        this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
        this.delay = options.delay || delay;
        this.output = "";
        this.exited = false;
        this.child = null;
        this.status = {
            configured: Boolean(this.serviceKey.configured),
            starting: false,
            running: false,
            proxyUrl: SYSTEM_TWINGATE_PROXY_URL,
            lastError: getInitialError(this.serviceKey),
        };
    }

    start() {
        if (!this.serviceKey.configured) {
            return this.status;
        }

        const validationError = validateServiceKeyJson(this.serviceKey.value);
        if (validationError) {
            this.status.lastError = validationError;
            return this.status;
        }

        try {
            this.writeServiceKey();
            const command = buildTwingatedCommand();
            const child = this.spawn(command.file, command.args, {
                stdio: ["ignore", "pipe", "pipe"],
            });
            this.child = child;
            this.status.starting = true;
            this.status.running = false;
            this.status.lastError = null;

            child.stdout?.on("data", (chunk) => this.captureOutput(chunk));
            child.stderr?.on("data", (chunk) => this.captureOutput(chunk));
            child.once("error", (error) => {
                this.exited = true;
                this.status.starting = false;
                this.status.running = false;
                this.status.lastError = `twingated failed to start: ${error.message}${this.formatOutputSuffix()}`;
            });
            child.once("exit", (code, signal) => {
                const wasReady = this.status.running;
                this.exited = true;
                this.status.starting = false;
                this.status.running = false;
                const exitValue = signal || code;
                const readinessText = wasReady ? "" : " before proxy became ready";
                this.status.lastError = `twingated exited with ${exitValue}${readinessText}${this.formatOutputSuffix()}`;
            });

            this.pollForReadiness();
        } catch (error) {
            this.status.starting = false;
            this.status.running = false;
            this.status.lastError = error.message;
        }

        return this.status;
    }

    writeServiceKey() {
        this.fs.mkdirSync("/etc/twingate", { recursive: true });
        this.fs.writeFileSync(SERVICE_KEY_PATH, this.serviceKey.value, { mode: 0o600 });
    }

    async pollForReadiness() {
        const startedAt = Date.now();
        while (this.status.starting && !this.exited) {
            if (await this.waitForProxyReady()) {
                if (!this.exited) {
                    this.status.starting = false;
                    this.status.running = true;
                    this.status.lastError = null;
                }
                return;
            }

            if (Date.now() - startedAt >= this.readyTimeoutMs) {
                this.status.starting = false;
                this.status.running = false;
                this.status.lastError =
                    `twingated did not open the proxy within ${this.readyTimeoutMs}ms${this.formatOutputSuffix()}`;
                this.child?.kill?.();
                return;
            }

            await this.delay(this.retryDelayMs);
        }
    }

    captureOutput(chunk) {
        const value = chunk.toString("utf8").trim();
        if (!value) {
            return;
        }
        this.output = `${this.output}\n${value}`.trim();
        if (this.output.length > MAX_CAPTURED_OUTPUT_LENGTH) {
            this.output = this.output.slice(-MAX_CAPTURED_OUTPUT_LENGTH);
        }
    }

    formatOutputSuffix() {
        return this.output ? `: ${this.output}` : "";
    }
}

function buildTwingatedCommand() {
    return {
        file: TWINGATED_FILE,
        args: ["--http-proxy", TWINGATE_PROXY_LISTEN_ADDRESS, "--tun", "off"],
    };
}

function validateServiceKeyJson(value) {
    try {
        const serviceKey = JSON.parse(Buffer.from(value || "").toString("utf8"));
        const missing = [
            "network",
            "service_account_id",
            "private_key",
            "key_id",
        ].filter((field) => !serviceKey[field]);

        return missing.length > 0
            ? `Twingate service key JSON is incomplete: missing ${missing.join(", ")}`
            : null;
    } catch (error) {
        return `Twingate service key JSON is invalid: ${error.message}`;
    }
}

function getInitialError(serviceKey) {
    if (serviceKey.configured || !serviceKey.missing?.length) {
        return null;
    }
    return `Twingate service key env is incomplete: missing ${serviceKey.missing.join(", ")}`;
}

function waitForProxyReady() {
    return new Promise((resolve) => {
        const socket = net.connect({
            host: TWINGATE_PROXY_READY_HOST,
            port: TWINGATE_PROXY_READY_PORT,
        });
        socket.once("connect", () => {
            socket.end();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
        socket.setTimeout(1000, () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    SYSTEM_TWINGATE_PROXY_URL,
    TwingateLifecycle,
    buildTwingatedCommand,
    validateServiceKeyJson,
    waitForProxyReady,
};
