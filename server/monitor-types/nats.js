const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { checkCertificate } = require("../util-server");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators, defaultNumberOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");
const net = require("net");
const tls = require("tls");

// Guards against a misbehaving server streaming data without ever sending a line break
const MAX_INFO_LENGTH = 64 * 1024;

class NatsMonitorType extends MonitorType {
    name = "nats";

    supportsConditions = true;

    conditionVariables = [
        new ConditionVariable("server_name", defaultStringOperators),
        new ConditionVariable("version", defaultStringOperators),
        new ConditionVariable("cluster", defaultStringOperators),
        new ConditionVariable("jetstream", defaultStringOperators),
        new ConditionVariable("tls_required", defaultStringOperators),
        new ConditionVariable("auth_required", defaultStringOperators),
        new ConditionVariable("headers", defaultStringOperators),
        new ConditionVariable("max_payload", defaultNumberOperators),
        new ConditionVariable("proto", defaultNumberOperators),
    ];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const tlsMode = monitor.natsTlsMode || "none";
        const timeoutMs = monitor.timeout * 1000 || 30000;
        const host = monitor.hostname;
        const port = monitor.port || 4222;
        const tlsOptions = {
            servername: net.isIP(host) ? undefined : host,
            rejectUnauthorized: !monitor.getIgnoreTls(),
        };

        const startTime = Date.now();
        let rawSocket = null;
        let tlsSocket = null;

        try {
            let info;

            if (tlsMode === "tls-first") {
                tlsSocket = await this.connectTls({ host, port, ...tlsOptions }, timeoutMs);
                info = await this.readInfo(tlsSocket, timeoutMs);
            } else {
                rawSocket = net.connect({ host, port });
                info = await this.readInfo(rawSocket, timeoutMs);

                if (tlsMode === "tls") {
                    tlsSocket = await this.connectTls({ socket: rawSocket, ...tlsOptions }, timeoutMs);
                }
            }

            heartbeat.ping = Date.now() - startTime;

            if (tlsSocket) {
                await monitor.handleTlsInfo(checkCertificate(tlsSocket));
            }

            if (monitor.natsRequireJetstream && info.jetstream !== true) {
                throw new Error("JetStream is not enabled on the server");
            }

            const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
            if (conditions && !evaluateExpressionGroup(conditions, this.getConditionData(info))) {
                throw new Error("Conditions not met");
            }

            heartbeat.status = UP;
            heartbeat.msg =
                `NATS ${info.version ?? "unknown version"} (${info.server_name ?? "unknown server"}), ` +
                `JetStream: ${info.jetstream ? "enabled" : "disabled"}`;
        } finally {
            tlsSocket?.destroy();
            rawSocket?.destroy();
        }
    }

    /**
     * Open a TLS connection (or upgrade an existing socket) and wait for the handshake
     * @param {tls.ConnectionOptions} options Options passed to tls.connect
     * @param {number} timeoutMs Handshake timeout in milliseconds
     * @returns {Promise<tls.TLSSocket>} Connected TLS socket
     */
    connectTls(options, timeoutMs) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect(options);

            const timer = setTimeout(() => {
                socket.destroy();
                reject(new Error("TLS handshake timed out"));
            }, timeoutMs);

            socket.once("secureConnect", () => {
                clearTimeout(timer);
                resolve(socket);
            });

            // Kept attached for the socket's lifetime so late errors are not unhandled
            socket.on("error", (error) => {
                clearTimeout(timer);
                socket.destroy();
                reject(new Error(`TLS handshake failed: ${error.message}`));
            });
        });
    }

    /**
     * Read the first protocol line from the server and parse the INFO payload
     * @param {net.Socket} socket Connected (or connecting) socket
     * @param {number} timeoutMs Timeout in milliseconds
     * @returns {Promise<object>} Parsed INFO JSON
     */
    readInfo(socket, timeoutMs) {
        return new Promise((resolve, reject) => {
            let buffer = "";

            const cleanup = () => {
                clearTimeout(timer);
                socket.removeListener("data", onData);
            };

            const fail = (error) => {
                cleanup();
                reject(error);
            };

            const onData = (chunk) => {
                buffer += chunk.toString("utf8");
                const lineEnd = buffer.indexOf("\r\n");

                if (lineEnd === -1) {
                    if (buffer.length > MAX_INFO_LENGTH) {
                        fail(new Error("INFO message exceeds maximum length"));
                    }
                    return;
                }

                const line = buffer.slice(0, lineEnd);
                const match = line.match(/^INFO\s+(.*)$/i);
                if (!match) {
                    fail(new Error(`Unexpected response from server: ${line.slice(0, 100)}`));
                    return;
                }

                try {
                    const info = JSON.parse(match[1]);
                    cleanup();
                    resolve(info);
                } catch {
                    fail(new Error("Invalid INFO payload received from server"));
                }
            };

            const timer = setTimeout(() => fail(new Error("Timed out waiting for INFO from server")), timeoutMs);

            socket.on("data", onData);
            socket.on("error", fail);
            socket.on("close", () => fail(new Error("Connection closed before INFO was received")));
        });
    }

    /**
     * Map INFO fields to condition variables
     * @param {object} info Parsed INFO JSON
     * @returns {object} Values for the condition variables
     */
    getConditionData(info) {
        return {
            server_name: info.server_name ?? "",
            version: info.version ?? "",
            cluster: info.cluster ?? "",
            jetstream: String(Boolean(info.jetstream)),
            tls_required: String(Boolean(info.tls_required)),
            auth_required: String(Boolean(info.auth_required)),
            headers: String(Boolean(info.headers)),
            max_payload: info.max_payload ?? 0,
            proto: info.proto ?? 0,
        };
    }
}

module.exports = {
    NatsMonitorType,
};
