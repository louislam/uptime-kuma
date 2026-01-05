const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const { checkCertificate } = require("../util-server");
const tls = require("tls");

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
    // Match patterns like "SSL alert number 116" or "alert number 116"
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

class TLSMonitorType extends MonitorType {
    name = "tls";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
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

        const expectedTlsAlert = monitor.expected_tls_alert;

        try {
            const result = await new Promise((resolve, reject) => {
                const socket = tls.connect(options);

                const timeoutId = setTimeout(() => {
                    socket.destroy();
                    reject(new Error("Connection timed out"));
                }, timeout);

                socket.on("secureConnect", () => {
                    clearTimeout(timeoutId);
                    const responseTime = Date.now() - startTime;

                    // Connection succeeded - no TLS alert
                    let tlsInfo = null;
                    if (monitor.isEnabledExpiryNotification()) {
                        try {
                            tlsInfo = checkCertificate(socket);
                        } catch (e) {
                            log.debug("tls", `[${monitor.name}] Error checking certificate: ${e.message}`);
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

                    // Try to parse TLS alert from error
                    const alertNumber = parseTlsAlertNumber(errorMessage);
                    const alertName = alertNumber !== null ? getTlsAlertName(alertNumber) : null;

                    log.debug("tls", `[${monitor.name}] TLS error: ${errorMessage}, alert: ${alertNumber} (${alertName})`);

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
                    reject(new Error("Connection timed out"));
                });
            });

            heartbeat.ping = result.responseTime;

            // Handle TLS info for certificate expiry monitoring
            if (result.tlsInfo && monitor.isEnabledExpiryNotification()) {
                await monitor.handleTlsInfo(result.tlsInfo);
            }

            // Determine if the result matches expectations
            if (expectedTlsAlert && expectedTlsAlert !== "none") {
                // User expects a specific TLS alert
                if (result.alertName === expectedTlsAlert) {
                    // Got the expected alert - this is UP (server correctly rejects)
                    heartbeat.status = UP;
                    heartbeat.msg = `TLS alert received as expected: ${result.alertName} (${result.alertNumber})`;
                } else if (result.success) {
                    // Connection succeeded but we expected an alert
                    throw new Error(`Expected TLS alert '${expectedTlsAlert}' but connection succeeded`);
                } else if (result.alertNumber !== null) {
                    // Got a different alert than expected
                    throw new Error(`Expected TLS alert '${expectedTlsAlert}' but got '${result.alertName}' (${result.alertNumber})`);
                } else {
                    // Connection failed without a TLS alert
                    throw new Error(`Expected TLS alert '${expectedTlsAlert}' but got error: ${result.errorMessage}`);
                }
            } else {
                // User expects successful connection (no alert)
                if (result.success) {
                    heartbeat.status = UP;
                    heartbeat.msg = `TLS connection successful (${result.responseTime} ms)`;

                    // Check certificate validity if enabled
                    if (result.tlsInfo && !result.tlsInfo.valid && !monitor.getIgnoreTls()) {
                        throw new Error("Certificate is invalid");
                    }
                } else if (result.alertNumber !== null) {
                    throw new Error(`TLS alert received: ${result.alertName} (${result.alertNumber})`);
                } else {
                    throw new Error(`TLS connection failed: ${result.errorMessage}`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new Error(message);
        }
    }
}

module.exports = {
    TLSMonitorType,
    TLS_ALERT_CODES,
};
