const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const net = require("net");
const tls = require("tls");
const unescape = require("unescape-js");

/**
 * Encloses a string in double quotes.
 * @param {string} s String to quote
 * @returns {string} Quoted string
 */
function quote(s) {
    return JSON.stringify(s);
}

/**
 * Truncates and appends an ellipsis (…) to a string if it is longer than a threshold, and encloses
 * the resulting string in double quotes.
 * @param {string} s String to ellipsize and/or quote
 * @returns {string} Ellipsized and/or quoted string
 */
function ellipsize(s) {
    const maxLen = 32;
    return quote(s.length <= maxLen ? s : `${s.substring(0, maxLen)}…`);
}

class TlsMonitorType extends MonitorType {
    name = "port-tls";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const abortController = new AbortController();

        const intervalS = monitor.interval || 30;
        const timeoutMs = intervalS * 1000 * 0.8;
        const timeoutID = setTimeout(() => {
            log.info(this.name, `timeout after ${timeoutMs} ms`);
            abortController.abort();
        }, timeoutMs);

        // Create a set of TLS options for better readability and to avoid passing the Monitor
        // object into what is fairly generic STARTTLS code.
        /**
         * @typedef TlsOptions
         * @type {object}
         * @property {string}  hostname    - Host name to connect to
         * @property {int}     port        - TCP port to connect to
         * @property {boolean} useStartTls - True if STARTTLS should be used, false for native TLS
         * @property {string}  prompt      - The server prompt to wait for before initiating STARTTLS
         * @property {string}  command     - The command to send to initiate STARTTLS
         * @property {string}  response    - The server response that indicates TLS negotiation readiness
         */
        const tlsOptions = {
            hostname: monitor.hostname,
            port: monitor.port,
            useStartTls: monitor.tcpStartTls,
            prompt: unescape(monitor.tcpStartTlsPrompt || ""),
            command: unescape(monitor.tcpStartTlsCommand || ""),
            response: unescape(monitor.tcpStartTlsResponse || ""),
        };

        const tlsSocket = await this.connect(abortController.signal, tlsOptions)
            .catch((error) => {
                abortController.abort();
                clearTimeout(timeoutID);
                throw error;
            })
        ;
        let tlsSocketClosed = false;
        tlsSocket.on("close", () => {
            tlsSocketClosed = true;
        });

        const request = unescape(monitor.tcpRequest || "");
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
            log.debug(this.name, "TLS socket commanded to close");
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
            log.info(this.name, "ERROR: " + response.message);
            throw response;
        }

        const [ success, message ] = this.checkResponseSuccess(response, monitor);
        if (success) {
            log.info(this.name, "SUCCESS: " + message);
            heartbeat.msg = message;
            heartbeat.status = UP;
        } else {
            log.info(this.name, "FAILURE: " + message);
            throw new Error(message);
        }
    }

    /**
     * Checks if the server response should be considered a success or not.
     * @param {string}  response Server response string
     * @param {Monitor} monitor  Monitor to check
     * @returns {[boolean, string]} Tuple with a boolean success indicator and a message string
     */
    checkResponseSuccess(response, monitor) {
        if (monitor.keyword) {
            // Monitor keyword present => Check if keyword is present/absent in response, depending
            // on whether the 'Invert Keyword' option is enabled.
            const keywordContained = response.includes(monitor.keyword);
            const message = `Keyword ${quote(monitor.keyword)} ${keywordContained ? "" : "not "}contained in response ${ellipsize(response)}`;
            return [ keywordContained === !monitor.invertKeyword, message ];
        } else {
            // No monitor keyword => Any response is considered a success.
            return [ true, "Connection successful" ];
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
            log.debug(this.name, `sending request: ${quote(request)}`);
            tlsSocket.write(request);
        }

        return await this.readData(aborter, tlsSocket, "request response");
    }

    /**
     * Connects to a given host and port using native TLS or STARTTLS.
     * @param {AbortController} aborter    Abort controller used to abort the connection
     * @param {TlsOptions}      tlsOptions TLS options to use for the connection
     * @returns {Promise<tls.TLSSocket>} TLS socket instance if successful or rejected promise on error
     */
    async connect(aborter, tlsOptions) {
        if (tlsOptions.useStartTls) {
            const socket = new net.Socket({
                signal: aborter
            });
            socket.connect(tlsOptions.port, tlsOptions.hostname);
            log.debug(this.name, "TCP connected");

            await this.startTls(aborter, socket, tlsOptions);
            log.debug(this.name, "STARTTLS prelude done");

            const tlsSocket = await this.upgradeConnection(socket);
            log.debug(this.name, "TLS upgrade done");
            tlsSocket.on("close", (hadError) => {
                socket.end();
            });
            return tlsSocket;
        } else {
            const tlsSocket = tls.connect(tlsOptions.port, tlsOptions.hostname, {
                signal: aborter,
                servername: tlsOptions.hostname
            });
            log.debug(this.name, "TLS connected");
            return tlsSocket;
        }
    }

    /**
     * Reads available data from the given socket.
     * @param {AbortController}            aborter Abort controller used to abort the read
     * @param {net.Socket | tls.TLSSocket} socket  Socket instance to use
     * @param {string}                     what    Human-readable name of the data we're waiting for
     * @returns {Promise<string>} Data read from the socket or rejected promise on error
     */
    readData(aborter, socket, what) {
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
                log.debug(this.name, `reading of ${what} aborted`);
                cleanup();
                reject(new Error(`Timeout while reading ${what}`));
            };

            const onError = (error) => {
                log.debug(this.name, `unable to read ${what} data: ${error.message}`);
                cleanup();
                reject(new Error(`Failed to read ${what}: ${error.message}`));
            };

            const onData = (data) => {
                const dataString = data.toString().trim();
                log.debug(this.name, `read ${what} data: ${quote(dataString)}`);
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
     * @param {string}                     what     Human-readable name of the data we're waiting for
     * @param {string}                     expected Prefix the response is expected to start with
     * @returns {Promise<string>} Data read from the socket or rejected promise if the response does
     *                            not start with the prefix
     */
    async expectDataStartsWith(aborter, socket, what, expected) {
        const data = await this.readData(aborter, socket, what);
        log.debug(this.name, `${what} data: ${quote(data)}, expected prefix: ${quote(expected)}`);
        if (!data.startsWith(expected)) {
            throw new Error(`Unexpected ${what}: ${ellipsize(data)} does not start with ${quote(expected)}`);
        }
    }

    /**
     * Performs STARTTLS on the given socket.
     * @param {AbortController}            aborter    Abort controller used to abort the STARTTLS process
     * @param {net.Socket | tls.TLSSocket} socket     Socket instance to use
     * @param {TlsOptions}                 tlsOptions TLS options to use for the connection
     * @returns {Promise<void>} Rejected promise if the STARTTLS process failed
     */
    async startTls(aborter, socket, tlsOptions) {
        log.debug(this.name, `starttls: waiting for prompt ${quote(tlsOptions.prompt)}…`);
        await this.expectDataStartsWith(aborter, socket, "STARTTLS prompt", tlsOptions.prompt);
        log.debug(this.name, `starttls: got prompt. sending command ${quote(tlsOptions.command)}`);
        socket.write(tlsOptions.command);
        log.debug(this.name, `starttls: sent command. waiting for response ${quote(tlsOptions.response)}…`);
        await this.expectDataStartsWith(aborter, socket, "STARTTLS response", tlsOptions.response);
        log.debug(this.name, "starttls: got response");
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
                log.debug(this.name, `connected: authorized: ${tlsSocket.authorized}, cipher: ${cipher ? cipher.name : "<none>"}`);
                resolve(tlsSocket);
            };

            const tlsSocket = tls.connect({ socket: socket });

            tlsSocket.on("secureConnect", onSecureConnect);
            tlsSocket.on("error", reject);
        });
    }
}

module.exports = {
    TlsMonitorType,
};
