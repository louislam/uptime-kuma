/**
 * Custom RADIUS Client Implementation
 *
 * This is a lightweight RADIUS client implementation using the base `radius` package
 * Due to lack of maintenance in node-radius-client this was forked
 *
 * Implements RADIUS Access-Request functionality compatible with the original
 * node-radius-client API used in Uptime Kuma.
 */

const dgram = require("dgram");
const radius = require("radius");

/**
 * RADIUS Client class
 */
class RadiusClient {
    /**
     * @param {object} options Client configuration
     * @param {string} options.host RADIUS server hostname
     * @param {number} options.hostPort RADIUS server port (default: 1812)
     * @param {number} options.timeout Request timeout in milliseconds (default: 2500)
     * @param {number} options.retries Number of retry attempts (default: 1)
     * @param {Array} options.dictionaries RADIUS dictionaries for attribute encoding
     */
    constructor(options) {
        this.host = options.host;
        this.port = options.hostPort || 1812;
        this.timeout = options.timeout || 2500;
        this.retries = options.retries || 1;
        this.dictionaries = options.dictionaries || [];
    }

    /**
     * Send RADIUS Access-Request
     * @param {object} params Request parameters
     * @param {string} params.secret RADIUS shared secret
     * @param {Array} params.attributes Array of [attribute, value] pairs
     * @returns {Promise<object>} RADIUS response
     */
    accessRequest(params) {
        return new Promise((resolve, reject) => {
            const { secret, attributes } = params;

            // Build RADIUS packet
            const packet = {
                code: "Access-Request",
                secret: secret,
                attributes: {}
            };

            // Convert attributes array to object
            attributes.forEach(([ attr, value ]) => {
                packet.attributes[attr] = value;
            });

            // Encode packet
            let encodedPacket;
            try {
                encodedPacket = radius.encode(packet);
            } catch (error) {
                return reject(new Error(`RADIUS packet encoding failed: ${error.message}`));
            }

            // Create UDP socket
            const socket = dgram.createSocket("udp4");
            let attempts = 0;
            let responseReceived = false;
            let timeoutHandle;

            /**
             * Send RADIUS request with retry logic
             * @returns {void}
             */
            const sendRequest = () => {
                attempts++;

                socket.send(encodedPacket, 0, encodedPacket.length, this.port, this.host, (err) => {
                    if (err) {
                        socket.close();
                        return reject(new Error(`Failed to send RADIUS request: ${err.message}`));
                    }

                    // Set timeout for this attempt
                    timeoutHandle = setTimeout(() => {
                        if (responseReceived) {
                            return;
                        }

                        if (attempts < this.retries + 1) {
                            // Retry
                            sendRequest();
                        } else {
                            // All retries exhausted
                            socket.close();
                            reject(new Error(`RADIUS request timeout after ${attempts} attempts`));
                        }
                    }, this.timeout);
                });
            };

            // Handle response
            socket.on("message", (msg) => {
                if (responseReceived) {
                    return;
                }

                responseReceived = true;
                clearTimeout(timeoutHandle);

                let response;
                try {
                    response = radius.decode({ packet: msg,
                        secret: secret });
                } catch (error) {
                    socket.close();
                    return reject(new Error(`RADIUS response decoding failed: ${error.message}`));
                }

                socket.close();

                // Map response code to match node-radius-client format
                const responseCode = response.code;

                if (responseCode === "Access-Accept") {
                    resolve({ code: "Access-Accept",
                        ...response });
                } else if (responseCode === "Access-Reject") {
                    // Reject as error to match original behavior
                    const error = new Error("Access-Reject");
                    error.response = { code: "Access-Reject" };
                    reject(error);
                } else if (responseCode === "Access-Challenge") {
                    // Challenge response
                    const error = new Error("Access-Challenge");
                    error.response = { code: "Access-Challenge" };
                    reject(error);
                } else {
                    resolve({ code: responseCode,
                        ...response });
                }
            });

            // Handle socket errors
            socket.on("error", (err) => {
                if (!responseReceived) {
                    responseReceived = true;
                    clearTimeout(timeoutHandle);
                    socket.close();
                    reject(new Error(`RADIUS socket error: ${err.message}`));
                }
            });

            // Start first request
            sendRequest();
        });
    }
}

module.exports = RadiusClient;
