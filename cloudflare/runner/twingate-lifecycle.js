/* eslint-disable jsdoc/require-jsdoc */
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const childProcess = require("node:child_process");
const { SYSTEM_TWINGATE_PROXY_URL } = require("./checker");

const SERVICE_KEY_PATH = "/etc/twingate/service_key.json";
const TWINGATED_FILE = "/usr/sbin/twingated";
const TWINGATE_PROXY_LISTEN_ADDRESS = "0.0.0.0:9999";
const TWINGATE_PROXY_READY_HOST = "127.0.0.1";
const TWINGATE_PROXY_READY_PORT = 9999;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_TWINGATE_RESTART_DELAY_MS = 1000;
const MAX_CAPTURED_OUTPUT_LENGTH = 4000;
const DEFAULT_TWINGATE_TUN_MODE = "off";

class TwingateLifecycle {
    constructor(options = {}) {
        this.serviceKey = options.serviceKey || { configured: false, missing: [] };
        this.tunMode = resolveTwingateTunMode(options.env || process.env);
        this.fs = options.fs || fs;
        this.spawn = options.spawn || childProcess.spawn;
        this.waitForProxyReady = options.waitForProxyReady || waitForProxyReady;
        this.readyTimeoutMs = options.readyTimeoutMs ?? getDefaultReadyTimeoutMs();
        this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
        this.restartDelayMs = options.restartDelayMs ?? getDefaultRestartDelayMs();
        this.delay = options.delay || delay;
        this.scheduleRestart = options.scheduleRestart || scheduleRestart;
        this.output = "";
        this.exited = false;
        this.restartScheduled = false;
        this.child = null;
        this.status = {
            configured: Boolean(this.serviceKey.configured),
            starting: false,
            running: false,
            proxyUrl: SYSTEM_TWINGATE_PROXY_URL,
            tunMode: this.tunMode,
            lastError: getInitialError(this.serviceKey),
            serviceKeyInspection: this.serviceKey.configured
                ? inspectServiceKeyJson(this.serviceKey.value)
                : null,
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

        if (this.status.running || this.status.starting || this.restartScheduled) {
            return this.status;
        }

        this.startTwingated();
        return this.status;
    }

    startTwingated() {
        try {
            this.writeServiceKey();
            const command = buildTwingatedCommand(this.tunMode);
            const child = this.spawn(command.file, command.args, {
                stdio: ["ignore", "pipe", "pipe"],
            });
            this.child = child;
            this.exited = false;
            this.restartScheduled = false;
            this.output = "";
            this.status.starting = true;
            this.status.running = false;
            this.status.lastError = null;

            child.stdout?.on("data", (chunk) => this.captureOutput(chunk));
            child.stderr?.on("data", (chunk) => this.captureOutput(chunk));
            child.once("error", (error) => {
                if (child !== this.child) {
                    return;
                }
                this.exited = true;
                this.scheduleTwingateRestart(
                    `twingated failed to start: ${error.message}${this.formatOutputSuffix()}`
                );
            });
            child.once("exit", (code, signal) => {
                if (child !== this.child) {
                    return;
                }
                const wasReady = this.status.running;
                this.exited = true;
                this.status.running = false;
                const exitValue = signal || code;
                const readinessText = wasReady ? "" : " before proxy became ready";
                const fatalError = extractTwingateFatalError(this.output);
                if (fatalError) {
                    this.status.starting = false;
                    this.status.lastError =
                        `twingated authentication failed: ${fatalError}${this.formatOutputSuffix()}`;
                    return;
                }
                this.scheduleTwingateRestart(
                    `twingated exited with ${exitValue}${readinessText}${this.formatOutputSuffix()}`
                );
            });

            this.pollForReadiness();
        } catch (error) {
            this.status.starting = false;
            this.status.running = false;
            this.status.lastError = error.message;
        }

        return this.status;
    }

    scheduleTwingateRestart(lastError) {
        if (this.restartScheduled) {
            return;
        }

        this.restartScheduled = true;
        this.status.starting = true;
        this.status.running = false;
        this.status.lastError = `${lastError}; restarting in ${this.restartDelayMs}ms`;
        const timer = this.scheduleRestart(() => {
            this.restartScheduled = false;
            this.status.starting = false;
            this.start();
        }, this.restartDelayMs);
        timer?.unref?.();
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

function buildTwingatedCommand(tunMode = DEFAULT_TWINGATE_TUN_MODE) {
    return {
        file: TWINGATED_FILE,
        args: ["--http-proxy", TWINGATE_PROXY_LISTEN_ADDRESS, "--tun", tunMode],
    };
}

function resolveTwingateTunMode(env = process.env) {
    return String(env.TWINGATE_TUN || DEFAULT_TWINGATE_TUN_MODE).toLowerCase() === "off" ? "off" : "on";
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

function inspectServiceKeyJson(value) {
    try {
        const raw = Buffer.from(value || "").toString("utf8");
        const parsed = JSON.parse(raw);
        const privateKey = String(parsed.private_key || "");
        return {
            validJson: true,
            fields: {
                version: Boolean(parsed.version),
                network: Boolean(parsed.network),
                service_account_id: Boolean(parsed.service_account_id),
                key_id: Boolean(parsed.key_id),
                private_key: Boolean(parsed.private_key),
                login_path: Boolean(parsed.login_path),
            },
            privateKeyShape: {
                length: privateKey.length,
                startsWithPemHeader: privateKey.startsWith("-----BEGIN "),
                endsWithPemFooter: /-----END [A-Z ]*PRIVATE KEY-----\s*$/.test(privateKey),
                containsLiteralBackslashN: privateKey.includes("\\n"),
                containsRealNewline: privateKey.includes("\n"),
                sha256Prefix: crypto
                    .createHash("sha256")
                    .update(privateKey)
                    .digest("hex")
                    .slice(0, 12),
            },
        };
    } catch (error) {
        return {
            validJson: false,
            error: error.message,
        };
    }
}

function extractTwingateFatalError(output = "") {
    const normalizedOutput = String(output);
    const patterns = [
        /failed to load key:\s*([^\n]+)/i,
        /failed to sign auth_token:[^\n]*/i,
        /failed to get an access token:[^\n]*/i,
        /Failed to login \([^)]+\)/i,
    ];

    for (const pattern of patterns) {
        const match = normalizedOutput.match(pattern);
        if (match) {
            return match[0].replace(/\s+/g, " ").trim();
        }
    }

    return null;
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

function scheduleRestart(callback, delayMs) {
    return setTimeout(callback, delayMs);
}

function getDefaultReadyTimeoutMs() {
    return Number(process.env.TWINGATE_READY_TIMEOUT_MS || 60000);
}

function getDefaultRestartDelayMs() {
    const parsed = Number(process.env.TWINGATE_RESTART_DELAY_MS || DEFAULT_TWINGATE_RESTART_DELAY_MS);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.round(parsed)
        : DEFAULT_TWINGATE_RESTART_DELAY_MS;
}

module.exports = {
    SYSTEM_TWINGATE_PROXY_URL,
    TwingateLifecycle,
    buildTwingatedCommand,
    extractTwingateFatalError,
    getDefaultReadyTimeoutMs,
    getDefaultRestartDelayMs,
    inspectServiceKeyJson,
    resolveTwingateTunMode,
    validateServiceKeyJson,
    waitForProxyReady,
};
