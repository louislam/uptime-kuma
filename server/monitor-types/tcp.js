const { MonitorType } = require("./monitor-type");
const { UP, PING_GLOBAL_TIMEOUT_DEFAULT: TIMEOUT, log } = require("../../src/util");
const { checkCertificate } = require("../util-server");
const tls = require("tls");
const net = require("net");
const tcpp = require("tcp-ping");

/**
 * Send TCP request to specified hostname and port
 * @param {string} hostname Hostname / address of machine
 * @param {number} port TCP port to test
 * @returns {Promise<number>} Maximum time in ms rounded to nearest integer
 */
const tcping = (hostname, port) => {
    return new Promise((resolve, reject) => {
        tcpp.ping(
            {
                address: hostname,
                port: port,
                attempts: 1,
            },
            (err, data) => {
                if (err) {
                    reject(err);
                }

                if (data.results.length >= 1 && data.results[0].err) {
                    reject(data.results[0].err);
                }

                resolve(Math.round(data.max));
            }
        );
    });
};

class TCPMonitorType extends MonitorType {
    name = "port";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        try {
            const resp = await tcping(monitor.hostname, monitor.port);
            heartbeat.ping = resp;
            heartbeat.msg = `${resp} ms`;
            heartbeat.status = UP;
        } catch {
            throw new Error("Connection failed");
        }

        let socket_;

        const preTLS = () =>
            new Promise((resolve, reject) => {
                let timeout;
                socket_ = net.connect(monitor.port, monitor.hostname);

                const onTimeout = () => {
                    log.debug(this.name, `[${monitor.name}] Pre-TLS connection timed out`);
                    reject("Connection timed out");
                };

                socket_.on("connect", () => {
                    log.debug(this.name, `[${monitor.name}] Pre-TLS connection: ${JSON.stringify(socket_)}`);
                });

                socket_.on("data", data => {
                    const response = data.toString();
                    const response_ = response.toLowerCase();
                    log.debug(this.name, `[${monitor.name}] Pre-TLS response: ${response}`);
                    switch (true) {
                        case response_.includes("start tls") || response_.includes("begin tls"):
                            timeout && clearTimeout(timeout);
                            resolve({ socket: socket_ });
                            break;
                        case response.startsWith("* OK") || response.match(/CAPABILITY.+STARTTLS/):
                            socket_.write("a001 STARTTLS\r\n");
                            break;
                        case response.startsWith("220") || response.includes("ESMTP"):
                            socket_.write(`EHLO ${monitor.hostname}\r\n`);
                            break;
                        case response.includes("250-STARTTLS"):
                            socket_.write("STARTTLS\r\n");
                            break;
                        default:
                            reject(`Unexpected response: ${response}`);
                    }
                });
                socket_.on("error", error => {
                    log.debug(this.name, `[${monitor.name}] ${error.toString()}`);
                    reject(error);
                });
                socket_.setTimeout(1000 * TIMEOUT, onTimeout);
                timeout = setTimeout(onTimeout, 1000 * TIMEOUT);
            });

        const reuseSocket = monitor.smtpSecurity === "starttls" ? await preTLS() : {};

        if ([ "secure", "starttls" ].includes(monitor.smtpSecurity) && monitor.isEnabledExpiryNotification()) {
            let socket = null;
            try {
                const options = {
                    host: monitor.hostname,
                    port: monitor.port,
                    servername: monitor.hostname,
                    ...reuseSocket,
                };

                const tlsInfoObject = await new Promise((resolve, reject) => {
                    socket = tls.connect(options);

                    socket.on("secureConnect", () => {
                        try {
                            const info = checkCertificate(socket);
                            resolve(info);
                        } catch (error) {
                            reject(error);
                        }
                    });

                    socket.on("error", error => {
                        reject(error);
                    });

                    socket.setTimeout(1000 * TIMEOUT, () => {
                        reject(new Error("Connection timed out"));
                    });
                });

                await monitor.handleTlsInfo(tlsInfoObject);
                if (!tlsInfoObject.valid) {
                    throw new Error("Certificate is invalid");
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                throw new Error(`TLS Connection failed: ${message}`);
            } finally {
                if (socket && !socket.destroyed) {
                    socket.end();
                }
            }
        }

        if (socket_ && !socket_.destroyed) {
            socket_.end();
        }
    }
}

module.exports = {
    TCPMonitorType,
};
