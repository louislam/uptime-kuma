const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const net = require("net");
const tls = require("tls");

class TlsMonitorType extends MonitorType {
    name = "port-tls";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const abortController = new AbortController();

        const timeoutMs = (monitor.interval || 30) * 1000 * 0.8;
        const timeoutID = setTimeout(() => {
            this.log(`timeout after ${timeoutMs} ms`);
            abortController.abort();
        }, timeoutMs);

        const tlsSocket = await this.connect(abortController.signal, monitor.hostname, monitor.port, monitor.tcpStartTls);
        let tlsSocketClosed = false;
        tlsSocket.on("close", () => {
            tlsSocketClosed = true;
        });

        const request = monitor.tcpRequest || null;
        const result = await this.getResponseFromTlsPort(abortController.signal, tlsSocket, request)
            .then((response) => {
                clearTimeout(timeoutID);
                return response;
            })
            .catch((error) => {
                clearTimeout(timeoutID);
                throw error;
            })
        ;

        if (!tlsSocketClosed) {
            tlsSocket.end();
            tlsSocket.destroy();
            this.debug_log("TLS socket commanded to close");
        }

        this.processResponse(result, monitor, heartbeat);
    }

    /**
     * Compares the server's response against the monitor's attributes, decides on success/failure,
     * and updates the heartbeat accordingly.
     * @param {string | Error} response  Response received from the server or Error on failure
     * @param {Monitor}        monitor   Monitor to check
     * @param {Heartbeat}      heartbeat Monitor heartbeat to update
     * @returns {void}
     * @throws Error if the check has failed or the response does not match the expectations
     */
    processResponse(response, monitor, heartbeat) {
        if (response instanceof Error) {
            this.log("check failed: " + response.message);
            throw response;
        }

        let success = false;
        let message = undefined;
        if (monitor.keyword) {
            const keywordContained = response.includes(monitor.keyword);
            success = (keywordContained === !monitor.invertKeyword);
            message = keywordContained ? "Data contains keyword" : "Data does not contain keyword";
        } else {
            success = true;
            message = "Connection successful";
        }

        if (success) {
            this.log("check successful: " + message);
            heartbeat.msg = message;
            heartbeat.status = UP;
        } else {
            this.log("check failed: " + message);
            throw new Error(message);
        }
    }

    /**
     * Sends the request over the given TLS socket and returns the response.
     * @param {AbortController} aborter   Abort controller used to abort the request
     * @param {tls.TLSSocket}   tlsSocket TLS socket instance
     * @param {string}          request   Request string (optional)
     * @returns {Promise<string>} Server response on success or rejected promise on error
     */
    async getResponseFromTlsPort(aborter, tlsSocket, request) {
        if (request) {
            this.debug_log(`sending request: '${request}'`);
            tlsSocket.write(request);
        }

        return await this.readData(aborter, tlsSocket);
    }

    /**
     * Connects to a given host and port using native TLS or STARTTLS.
     * @param {AbortController} aborter     Abort controller used to abort the connection
     * @param {string}          hostname    Host to connect to
     * @param {int}             port        TCP port to connect to
     * @param {boolean}         useStartTls True if STARTTLS should be used, false for native TLS
     * @returns {Promise<tls.TLSSocket>} TLS socket instance if successful or rejected promise on error
     */
    async connect(aborter, hostname, port, useStartTls) {
        if (useStartTls) {
            const socket = new net.Socket({
                signal: aborter
            });
            socket.connect(port, hostname);
            this.debug_log("TCP connected");

            await this.startTls(aborter, socket);
            this.debug_log("STARTTLS prelude done");

            const tlsSocket = await this.upgradeConnection(socket);
            this.debug_log("TLS upgrade done");
            tlsSocket.on("close", (hadError) => {
                socket.end();
            });
            return tlsSocket;
        } else {
            const tlsSocket = tls.connect(port, hostname, {
                signal: aborter,
                servername: hostname
            });
            this.debug_log("TLS connected");
            return tlsSocket;
        }
    }

    /**
     * Reads available data from the given socket.
     * @param {AbortController}            aborter Abort controller used to abort the read
     * @param {net.Socket | tls.TLSSocket} socket  Socket instance to use
     * @returns {Promise<string>} Data read from the socket or rejected promise on error
     */
    readData(aborter, socket) {
        return new Promise((resolve, reject) => {
            const cleanup = function () {
                // Pause reading of data (i.e. emission of 'data' events), so that we don't lose
                // any data between now and the next call to readData() while there are no event
                // listeners installed.
                socket.pause();
                socket.removeListener("error", onError);
                socket.removeListener("data", onData);
                aborter.removeEventListener("abort", onAbort);
            };

            const onAbort = (_) => {
                this.debug_log("read aborted");
                cleanup();
                reject(new Error("Timeout"));
            };

            const onError = (error) => {
                this.debug_log(`unable to read data: ${error}`);
                cleanup();
                reject(new Error(`Failed to read data: ${error}`));
            };

            const onData = (data) => {
                const dataString = data.toString().trim();
                this.debug_log(`read data: '${dataString}'`);
                cleanup();
                resolve(dataString);
            };

            aborter.addEventListener("abort", onAbort, { once: true });

            // Register event callbacks and resume the socket. We are ready to receive data.
            socket.on("error", onError);
            socket.on("data", onData);
            socket.resume();
        });
    }

    /**
     * Reads available data from the given socket if it starts with a given prefix.
     * @param {AbortController}            aborter  Abort controller used to abort the read
     * @param {net.Socket | tls.TLSSocket} socket   Socket instance to use
     * @param {string}                     expected Prefix the response is expected to start with
     * @returns {Promise<string>} Data read from the socket or rejected promise if the response does
     *                            not start with the prefix
     */
    async expectDataStartsWith(aborter, socket, expected) {
        const data = await this.readData(aborter, socket);
        this.debug_log(`response data: '${data}', expected: '${expected}'…`);
        if (!data.startsWith(expected)) {
            throw new Error(`Unexpected response. Data: '${data}', Expected: '${expected}'…`);
        }
    }

    /**
     * Performs STARTTLS on the given socket.
     * @param {AbortController}            aborter Abort controller used to abort the STARTTLS process
     * @param {net.Socket | tls.TLSSocket} socket  Socket instance to use
     * @returns {Promise<void>} Rejected promise if the STARTTLS process failed
     */
    async startTls(aborter, socket) {
        this.debug_log("waiting for prompt");
        await this.expectDataStartsWith(aborter, socket, "220 ");
        this.debug_log("sending STARTTLS");
        socket.write("STARTTLS\n");
        this.debug_log("waiting for ready-to-TLS");
        await this.expectDataStartsWith(aborter, socket, "220 ");
    }

    /**
     * Upgrades an unencrypted socket to a TLS socket using STARTTLS.
     * @param {net.Socket} socket Socket representing the unencrypted connection
     * @returns {Promise<tls.TLSSocket>} Socket instance representing the upgraded TLS connection
     *                                   or rejected promise if the STARTTLS process failed
     */
    upgradeConnection(socket) {
        return new Promise((resolve, reject) => {
            const onSecureConnect = () => {
                const cipher = tlsSocket.getCipher();
                this.debug_log(`connected: authorized: ${tlsSocket.authorized}, cipher: ${cipher ? cipher.name : "<none>"}`);
                resolve(tlsSocket);
            };

            const tlsSocket = tls.connect({ socket: socket });

            tlsSocket.on("secureConnect", onSecureConnect);
            tlsSocket.on("error", reject);
        });
    }

    /**
     * Logs a message.
     * @param {*} msg Message
     * @returns {void}
     */
    log(msg) {
        log.debug(this.name, msg);
    }

    /**
     * Logs a debug message (disabled by default).
     * @param {*} msg Message
     * @returns {void}
     */
    debug_log(msg) {
        //log.debug(this.name, msg);
    }
}

module.exports = {
    TlsMonitorType,
};
