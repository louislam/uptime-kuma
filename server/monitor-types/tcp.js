const { MonitorType } = require("./monitor-type");
const { UP, PING_GLOBAL_TIMEOUT_DEFAULT: TIMEOUT, log } = require("../../src/util");
const { checkCertificate } = require("../util-server");
const tls = require("tls");
const net = require("net");
const tcpp = require("tcp-ping");

/**
 * TLS Alert codes as defined in RFC 5246 and RFC 8446
 * @see https://www.iana.org/assignments/tls-parameters/tls-parameters.xhtml#tls-parameters-6
 */
const TLS_ALERT_CODES = {
    0: "close_notify",
    10: "unexpected_message",
    20: "bad_record_mac",
    21: "decryption_failed",
    22: "record_overflow",
    30: "decompression_failure",
    40: "handshake_failure",
    41: "no_certificate",
    42: "bad_certificate",
    43: "unsupported_certificate",
    44: "certificate_revoked",
    45: "certificate_expired",
    46: "certificate_unknown",
    47: "illegal_parameter",
    48: "unknown_ca",
    49: "access_denied",
    50: "decode_error",
    51: "decrypt_error",
    60: "export_restriction",
    70: "protocol_version",
    71: "insufficient_security",
    80: "internal_error",
    86: "inappropriate_fallback",
    90: "user_canceled",
    100: "no_renegotiation",
    109: "missing_extension",
    110: "unsupported_extension",
    111: "certificate_unobtainable",
    112: "unrecognized_name",
    113: "bad_certificate_status_response",
    114: "bad_certificate_hash_value",
    115: "unknown_psk_identity",
    116: "certificate_required",
    120: "no_application_protocol",
};

/**
 * Parse TLS alert number from error message
 * @param {string} errorMessage Error message from TLS connection
 * @returns {number|null} TLS alert number or null if not found
 */
function parseTlsAlertNumber(errorMessage) {
    const match = errorMessage.match(/alert number (\d+)/i);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Get TLS alert name from alert number
 * @param {number} alertNumber TLS alert number
 * @returns {string} TLS alert name or "unknown_alert"
 */
function getTlsAlertName(alertNumber) {
    return TLS_ALERT_CODES[alertNumber] || `unknown_alert_${alertNumber}`;
}

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
        const expectedTlsAlert = monitor.expected_tls_alert;

        // If expecting a TLS alert, use TLS connection with alert detection
        if (expectedTlsAlert && expectedTlsAlert !== "none") {
            await this.checkTlsAlert(monitor, heartbeat, expectedTlsAlert);
            return;
        }

        // Standard TCP check
        await this.checkTcp(monitor, heartbeat);
    }

    /**
     * Standard TCP connectivity check
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @returns {Promise<void>}
     */
    async checkTcp(monitor, heartbeat) {
        try {
            const resp = await tcping(monitor.hostname, monitor.port);
            heartbeat.ping = resp;
            heartbeat.msg = `${resp} ms`;
            heartbeat.status = UP;
        } catch {
            throw new Error("Connection failed");
        }

        let socket_;

        // Handle TLS certificate checking for secure/starttls connections
        if (["secure", "starttls"].includes(monitor.smtpSecurity) && monitor.isEnabledExpiryNotification()) {
            const reuseSocket = monitor.smtpSecurity === "starttls" ? await this.performStartTls(monitor) : {};
            socket_ = reuseSocket.socket;
            await this.checkTlsCertificate(monitor, reuseSocket);
        }

        if (socket_ && !socket_.destroyed) {
            socket_.end();
        }
    }

    /**
     * Perform STARTTLS handshake for various protocols (SMTP, IMAP, XMPP)
     * @param {object} monitor Monitor object
     * @returns {Promise<{socket: net.Socket}>} Object containing the socket
     */
    performStartTls(monitor) {
        return new Promise((resolve, reject) => {
            let dialogTimeout;
            let bannerTimeout;
            const socket_ = net.connect(monitor.port, monitor.hostname);

            const onTimeout = () => {
                log.debug(this.name, `[${monitor.name}] Pre-TLS connection timed out`);
                doReject("Connection timed out");
            };

            const onBannerTimeout = () => {
                log.debug(this.name, `[${monitor.name}] Pre-TLS timed out waiting for banner`);
                // No banner. Could be a XMPP server?
                socket_.write(
                    `<stream:stream to='${monitor.hostname}' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>`
                );
            };

            const doResolve = () => {
                dialogTimeout && clearTimeout(dialogTimeout);
                bannerTimeout && clearTimeout(bannerTimeout);
                resolve({ socket: socket_ });
            };

            const doReject = (error) => {
                dialogTimeout && clearTimeout(dialogTimeout);
                bannerTimeout && clearTimeout(bannerTimeout);
                socket_.end();
                reject(error);
            };

            socket_.on("connect", () => {
                log.debug(this.name, `[${monitor.name}] Pre-TLS connection: ${JSON.stringify(socket_)}`);
            });

            socket_.on("data", (data) => {
                const response = data.toString();
                const response_ = response.toLowerCase();
                log.debug(this.name, `[${monitor.name}] Pre-TLS response: ${response}`);
                clearTimeout(bannerTimeout);
                switch (true) {
                    case response_.includes("start tls") || response_.includes("begin tls"):
                        doResolve();
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
                    case response_.includes("<proceed"):
                        doResolve();
                        break;
                    case response_.includes("<starttls"):
                        socket_.write('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>');
                        break;
                    case response_.includes("<stream:stream") || response_.includes("</stream:stream>"):
                        break;
                    default:
                        doReject(`Unexpected response: ${response}`);
                }
            });
            socket_.on("error", (error) => {
                log.debug(this.name, `[${monitor.name}] ${error.toString()}`);
                reject(error);
            });
            socket_.setTimeout(1000 * TIMEOUT, onTimeout);
            dialogTimeout = setTimeout(onTimeout, 1000 * TIMEOUT);
            bannerTimeout = setTimeout(onBannerTimeout, 1000 * 1.5);
        });
    }

    /**
     * Check TLS certificate validity
     * @param {object} monitor Monitor object
     * @param {object} reuseSocket Socket to reuse for STARTTLS
     * @returns {Promise<void>}
     */
    async checkTlsCertificate(monitor, reuseSocket) {
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

                socket.on("error", (error) => {
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

    /**
     * Check for expected TLS alert (for mTLS verification)
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @param {string} expectedTlsAlert Expected TLS alert name
     * @returns {Promise<void>}
     */
    async checkTlsAlert(monitor, heartbeat, expectedTlsAlert) {
        const timeout = monitor.timeout * 1000 || 30000;
        const startTime = Date.now();

        const options = {
            host: monitor.hostname,
            port: monitor.port || 443,
            servername: monitor.hostname,
            rejectUnauthorized: !monitor.getIgnoreTls(),
            timeout: timeout,
        };

        // Add client certificate if provided (for mTLS testing with cert)
        if (monitor.tlsCert && monitor.tlsKey) {
            options.cert = monitor.tlsCert;
            options.key = monitor.tlsKey;
            if (monitor.tlsCa) {
                options.ca = monitor.tlsCa;
            }
        }

        const result = await this.attemptTlsConnection(monitor, options, startTime, timeout);

        heartbeat.ping = result.responseTime;

        // Handle TLS info for certificate expiry monitoring
        if (result.tlsInfo && monitor.isEnabledExpiryNotification()) {
            await monitor.handleTlsInfo(result.tlsInfo);
        }

        // Check if we got the expected alert
        // Note: Error messages below could be translated, but alert names (e.g., certificate_required)
        // are from RFC 8446 spec and should remain in English for consistency with the spec.
        if (result.alertName === expectedTlsAlert) {
            heartbeat.status = UP;
            heartbeat.msg = `TLS alert received as expected: ${result.alertName} (${result.alertNumber})`;
        } else if (result.success) {
            throw new Error(
                `Expected TLS alert '${expectedTlsAlert}' but connection succeeded. The server accepted the connection without requiring a client certificate.`
            );
        } else if (result.alertNumber !== null) {
            throw new Error(
                `Expected TLS alert '${expectedTlsAlert}' but received '${result.alertName}' (${result.alertNumber})`
            );
        } else {
            throw new Error(
                `Expected TLS alert '${expectedTlsAlert}' but got unexpected error: ${result.errorMessage}`
            );
        }
    }

    /**
     * Attempt TLS connection and capture result/alert
     * @param {object} monitor Monitor object
     * @param {object} options TLS connection options
     * @param {number} startTime Connection start timestamp
     * @param {number} timeout Connection timeout in ms
     * @returns {Promise<object>} Connection result with success, responseTime, tlsInfo, alertNumber, alertName, errorMessage
     */
    attemptTlsConnection(monitor, options, startTime, timeout) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect(options);

            const timeoutId = setTimeout(() => {
                socket.destroy();
                reject(new Error("TLS connection timed out"));
            }, timeout);

            socket.on("secureConnect", () => {
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                let tlsInfo = null;
                if (monitor.isEnabledExpiryNotification()) {
                    try {
                        tlsInfo = checkCertificate(socket);
                    } catch (e) {
                        log.debug(this.name, `[${monitor.name}] Error checking certificate: ${e.message}`);
                    }
                }

                socket.end();
                resolve({
                    success: true,
                    responseTime,
                    tlsInfo,
                    alertNumber: null,
                    alertName: null,
                });
            });

            socket.on("error", (error) => {
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;
                const errorMessage = error.message || error.toString();

                const alertNumber = parseTlsAlertNumber(errorMessage);
                const alertName = alertNumber !== null ? getTlsAlertName(alertNumber) : null;

                log.debug(
                    this.name,
                    `[${monitor.name}] TLS error: ${errorMessage}, alert: ${alertNumber} (${alertName})`
                );

                resolve({
                    success: false,
                    responseTime,
                    tlsInfo: null,
                    alertNumber,
                    alertName,
                    errorMessage,
                });
            });

            socket.on("timeout", () => {
                clearTimeout(timeoutId);
                socket.destroy();
                reject(new Error("TLS connection timed out"));
            });
        });
    }
}

module.exports = {
    TCPMonitorType,
    TLS_ALERT_CODES,
    parseTlsAlertNumber,
    getTlsAlertName,
};
