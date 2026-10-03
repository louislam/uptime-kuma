const net = require("net");
const tls = require("tls");

/**
 * Cancellable NTRIP client transport for revisions 1 and 2.
 *
 * The transport is responsible for exactly one connection: perform the
 * handshake, hand raw stream bytes to the caller, and report one terminal
 * failure. It owns no retry policy and no timers; the session decides when to
 * give up and when to reconnect.
 *
 * Cancellation, whether through the abort signal or close(), is never reported
 * as a failure: the session already knows it asked for the connection to end,
 * and a spurious failure there would drive an unnecessary reconnect.
 *
 * Failures carry safe messages only. The Authorization header and the
 * configured password never appear in an error, a log line or a heartbeat.
 */

/** Largest handshake response header accepted before the connection is rejected. */
const MAX_HEADER_BYTES = 16384;

const CRLF = "\r\n";
const HEADER_END = "\r\n\r\n";

/** RTCM 3 frames begin with this byte, which no header line can start with. */
const RTCM_PREAMBLE = 0xd3;

/** Identifies the client to the caster, as NTRIP requires. */
const USER_AGENT = "NTRIP UptimeKuma";

/**
 * Response codes meaning the caster is throttling this client.
 *
 * A caster that limits concurrent sessions per account answers a reconnect this
 * way while the previous session is still registered, so the short reconnect
 * backoff would walk straight back into the same refusal.
 *
 * 406 is deliberately absent. It reads as a refusal, but casters observed in
 * practice use it for "this mountpoint has no data source right now", which is
 * precisely the outage this monitor exists to detect. Holding a cooldown there
 * would delay noticing that the stream came back.
 */
const BUSY_STATUS_CODES = new Set([409, 429]);

/**
 * Describe a socket failure in plain words.
 *
 * Node reports these as terse codes such as "connect ECONNREFUSED 1.2.3.4:2101",
 * which read as noise in an event list. Anything not recognised keeps Node's text.
 * @param {unknown} error Socket or TLS error
 * @param {object} config Normalized NTRIP configuration
 * @returns {string} Message for the heartbeat
 */
function describeSocketError(error, config) {
    const code = error && typeof error.code === "string" ? error.code : "";

    if (code === "ENOTFOUND") {
        return `Could not find the caster's host name '${config.hostname}'.`;
    }
    if (code === "EAI_AGAIN") {
        return `Could not look up '${config.hostname}' (DNS is not responding).`;
    }
    if (code === "ECONNREFUSED") {
        return `The caster refused the connection on port ${config.port}.`;
    }
    if (code === "ECONNRESET") {
        return "The connection to the caster was reset.";
    }
    if (["EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT"].includes(code)) {
        return `Could not reach the caster at ${config.hostname}:${config.port}.`;
    }
    if (/CERT|SELF_SIGNED|UNABLE_TO_|ERR_TLS/.test(code)) {
        return "The caster's TLS certificate was not accepted.";
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "The connection to the caster failed.";
}

/**
 * Open a socket, using TLS when the monitor requests it.
 * @param {object} options Connection options
 * @param {boolean} useTls Whether to negotiate TLS
 * @returns {object} Connected socket
 */
function defaultCreateConnection(options, useTls) {
    return useTls ? tls.connect(options) : net.connect(options);
}

/**
 * Decode HTTP chunked transfer encoding incrementally.
 *
 * Chunk boundaries carry no meaning for RTCM, so decoded payload bytes are
 * emitted as soon as they are available, in arbitrary sizes.
 * @param {Function} emit Receives each decoded payload buffer
 * @param {Function} fail Called with a protocol error
 * @returns {object} Decoder exposing push()
 */
function createChunkedDecoder(emit, fail) {
    let buffer = Buffer.alloc(0);
    let remaining = 0;
    let state = "size";

    return {
        /**
         * Consume encoded bytes.
         * @param {Buffer} chunk Encoded bytes
         * @returns {void}
         */
        push(chunk) {
            buffer = Buffer.concat([buffer, chunk]);

            for (;;) {
                if (state === "done") {
                    return;
                }

                if (state === "size") {
                    const lineEnd = buffer.indexOf(CRLF);
                    if (lineEnd === -1) {
                        return;
                    }
                    const size = parseInt(buffer.subarray(0, lineEnd).toString("ascii").split(";")[0].trim(), 16);
                    if (!Number.isInteger(size) || size < 0) {
                        fail(new Error("The caster sent a corrupted stream (bad chunked encoding)."));
                        return;
                    }
                    buffer = Buffer.from(buffer.subarray(lineEnd + 2));
                    if (size === 0) {
                        state = "done";
                        return;
                    }
                    remaining = size;
                    state = "data";
                    continue;
                }

                if (state === "data") {
                    if (buffer.length === 0) {
                        return;
                    }
                    const take = Math.min(remaining, buffer.length);
                    emit(Buffer.from(buffer.subarray(0, take)));
                    buffer = Buffer.from(buffer.subarray(take));
                    remaining -= take;
                    if (remaining === 0) {
                        state = "trailer";
                    }
                    continue;
                }

                // state === "trailer": consume the CRLF that ends a chunk.
                if (buffer.length < 2) {
                    return;
                }
                buffer = Buffer.from(buffer.subarray(2));
                state = "size";
            }
        },
    };
}

/**
 * Encode Basic credentials without ever exposing them to a caller.
 * @param {string} username Account name
 * @param {string} password Account password
 * @returns {string} Base64 credential string
 */
function encodeBasic(username, password) {
    return Buffer.from(`${username}:${password ?? ""}`, "utf8").toString("base64");
}

/**
 * Build the handshake request for the configured NTRIP revision.
 * @param {object} config Normalized NTRIP configuration
 * @returns {string} Complete request text
 */
function buildRequest(config) {
    const lines = [];

    if (config.revision === "1") {
        lines.push(`GET /${config.mountpoint} HTTP/1.0`);
        lines.push(`User-Agent: ${USER_AGENT}`);
        lines.push("Accept: */*");
    } else {
        lines.push(`GET /${config.mountpoint} HTTP/1.1`);
        lines.push(`Host: ${config.hostname}:${config.port}`);
        lines.push("Ntrip-Version: Ntrip/2.0");
        lines.push(`User-Agent: ${USER_AGENT}`);
        lines.push("Connection: close");
    }

    if (config.username) {
        lines.push(`Authorization: Basic ${encodeBasic(config.username, config.password)}`);
    }

    return `${lines.join(CRLF)}${HEADER_END}`;
}

/**
 * Open one NTRIP connection.
 * @param {object} config Normalized NTRIP configuration
 * @param {object} callbacks Transport callbacks
 * @param {AbortSignal} callbacks.signal Cancels the connection at any stage
 * @param {Function} callbacks.onAccepted Called once the caster accepts the request
 * @param {Function} callbacks.onData Called with raw stream bytes
 * @param {Function} callbacks.onFailure Called at most once with a safe error
 * @param {object} dependencies Injected collaborators
 * @param {Function} dependencies.createConnection Socket factory, for testing
 * @returns {object} Connection exposing write() and close()
 */
function openNtripTransport(config, callbacks, dependencies = {}) {
    const { signal, onAccepted, onData, onFailure } = callbacks;
    const createConnection = dependencies.createConnection ?? defaultCreateConnection;

    let finished = false;
    let streaming = false;
    let headerBuffer = Buffer.alloc(0);
    let chunked = null;
    let socket = null;

    /**
     * Release the socket exactly once. Never reports a failure.
     * @returns {void}
     */
    const finish = () => {
        if (finished) {
            return;
        }
        finished = true;
        if (signal) {
            signal.removeEventListener("abort", finish);
        }
        try {
            socket?.destroy();
        } catch {
            // A socket that refuses to close must not throw into a callback.
        }
    };

    /**
     * Report the single terminal failure for this connection.
     * @param {Error} error Safe failure description
     * @returns {void}
     */
    const fail = (error) => {
        if (finished) {
            return;
        }
        finish();
        onFailure(error);
    };

    /**
     * Hand payload bytes to the caller, decoding chunked framing when present.
     * @param {Buffer} chunk Payload bytes
     * @returns {void}
     */
    const deliver = (chunk) => {
        if (chunk.length === 0) {
            return;
        }
        if (chunked) {
            chunked.push(chunk);
        } else {
            onData(chunk);
        }
    };

    /**
     * Enter the streaming phase and release any bytes already buffered.
     * @param {Buffer} initial Stream bytes received alongside the header
     * @returns {void}
     */
    const accept = (initial) => {
        streaming = true;
        headerBuffer = Buffer.alloc(0);
        onAccepted();
        if (!finished) {
            deliver(initial);
        }
    };

    /**
     * Apply the status line and headers of a complete handshake response.
     * @param {string} headerText Status line and headers, without the blank line
     * @param {Buffer} body Bytes following the header
     * @returns {void}
     */
    const evaluate = (headerText, body) => {
        const lines = headerText.split(CRLF);
        const statusLine = lines[0] ?? "";
        const headers = {};

        for (const line of lines.slice(1)) {
            const separator = line.indexOf(":");
            if (separator > 0) {
                headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
            }
        }

        if (/^SOURCETABLE/i.test(statusLine)) {
            fail(new Error(`Mountpoint '${config.mountpoint}' is not active on the caster.`));
            return;
        }

        if (/^ICY 200 OK/i.test(statusLine)) {
            accept(body);
            return;
        }

        const status = /^HTTP\/1\.[01] (\d{3})(?: .*)?$/.exec(statusLine);
        if (!status) {
            fail(
                new Error(
                    "The caster sent a response this monitor does not recognise. Check the host, port and NTRIP version."
                )
            );
            return;
        }

        const code = Number(status[1]);

        if (code === 401 || code === 403) {
            // Categorized so the session applies its longer cooldown instead of
            // hammering a caster that is rejecting these credentials.
            fail(
                Object.assign(new Error("The caster rejected the username or password."), {
                    code: "AUTH",
                })
            );
            return;
        }
        if (code === 404) {
            fail(new Error(`Mountpoint '${config.mountpoint}' was not found on the caster.`));
            return;
        }
        if (code >= 300 && code < 400) {
            // Following a redirect would resend credentials to an unverified host.
            fail(new Error("The caster tried to redirect the connection. Redirects are not followed."));
            return;
        }
        if (code === 406) {
            // Not a client error in practice. Casters answer this way when the
            // mountpoint is listed but its source has stopped feeding it, so the
            // message has to name the likely cause rather than the HTTP wording.
            fail(new Error(`Mountpoint '${config.mountpoint}' currently has no data source.`));
            return;
        }
        if (BUSY_STATUS_CODES.has(code)) {
            // Categorized so the session waits the caster out instead of
            // reconnecting into an identical refusal every few seconds.
            fail(
                Object.assign(new Error("The caster is limiting connections. Waiting before retrying."), {
                    code: "BUSY",
                })
            );
            return;
        }
        if (code !== 200) {
            fail(new Error("The caster returned an unexpected response."));
            return;
        }

        if ((headers["content-type"] ?? "").toLowerCase().includes("sourcetable")) {
            fail(new Error(`Mountpoint '${config.mountpoint}' is not active on the caster.`));
            return;
        }

        const encoding = (headers["content-encoding"] ?? "").toLowerCase();
        if (encoding !== "" && encoding !== "identity") {
            fail(new Error("The caster compressed the stream, which is not supported."));
            return;
        }

        if ((headers["transfer-encoding"] ?? "").toLowerCase().includes("chunked")) {
            chunked = createChunkedDecoder((payload) => onData(payload), fail);
        }

        accept(body);
    };

    /**
     * Parse buffered handshake bytes, tolerating Rev1 responses that omit the
     * blank line that normally terminates HTTP headers.
     * @returns {void}
     */
    const processHeader = () => {
        if (config.revision === "1") {
            const lineEnd = headerBuffer.indexOf(CRLF);
            if (lineEnd === -1) {
                return;
            }

            if (/^ICY 200 OK/i.test(headerBuffer.subarray(0, lineEnd).toString("ascii"))) {
                const rest = headerBuffer.subarray(lineEnd + 2);

                if (rest.length === 0) {
                    accept(Buffer.alloc(0));
                    return;
                }
                if (rest[0] === 0x0d) {
                    // A blank line may still be arriving one byte at a time.
                    if (rest.length < 2) {
                        return;
                    }
                    accept(Buffer.from(rest.subarray(2)));
                    return;
                }
                if (rest[0] === RTCM_PREAMBLE) {
                    accept(Buffer.from(rest));
                    return;
                }

                // Anything else is an HTTP-style header block after the status line.
                const headerEnd = headerBuffer.indexOf(HEADER_END);
                if (headerEnd === -1) {
                    return;
                }
                accept(Buffer.from(headerBuffer.subarray(headerEnd + 4)));
                return;
            }
        }

        const headerEnd = headerBuffer.indexOf(HEADER_END);
        if (headerEnd === -1) {
            return;
        }
        evaluate(
            headerBuffer.subarray(0, headerEnd).toString("ascii"),
            Buffer.from(headerBuffer.subarray(headerEnd + 4))
        );
    };

    if (signal?.aborted) {
        finished = true;
        return { write: () => {}, close: () => {} };
    }
    signal?.addEventListener("abort", finish, { once: true });

    const options = { host: config.hostname, port: config.port };
    if (config.tls) {
        options.servername = config.hostname;
    }

    try {
        socket = createConnection(options, Boolean(config.tls));
    } catch {
        fail(new Error("Could not open a connection to the caster."));
        return { write: () => {}, close: finish };
    }

    if (typeof socket.setNoDelay === "function") {
        socket.setNoDelay(true);
    }

    /**
     * Send the handshake once the socket is usable.
     * @returns {void}
     */
    const sendRequest = () => {
        if (finished) {
            return;
        }
        try {
            socket.write(buildRequest(config));
        } catch {
            fail(new Error("Could not send the request to the caster."));
        }
    };

    socket.on("connect", sendRequest);
    socket.on("secureConnect", sendRequest);

    socket.on("data", (chunk) => {
        if (finished) {
            return;
        }
        if (streaming) {
            deliver(chunk);
            return;
        }

        headerBuffer = Buffer.concat([headerBuffer, chunk]);
        if (headerBuffer.length > MAX_HEADER_BYTES) {
            fail(new Error("The caster's response header was too large (over 16 KiB)."));
            return;
        }
        processHeader();
    });

    socket.on("error", (error) => {
        fail(new Error(describeSocketError(error, config)));
    });

    /**
     * Report the caster hanging up. Close and end both mean this, and
     * whichever arrives first wins.
     * @returns {void}
     */
    const hangUp = () => {
        fail(
            new Error(
                streaming
                    ? "The caster closed the stream."
                    : "The caster closed the connection without answering the request."
            )
        );
    };

    socket.on("close", hangUp);
    socket.on("end", hangUp);

    return {
        /**
         * Send bytes to the caster, such as a periodic GGA sentence.
         * @param {Buffer} data Bytes to send
         * @returns {void}
         */
        write(data) {
            if (finished || !socket.writable) {
                return;
            }
            try {
                socket.write(data);
            } catch {
                // A failed write surfaces through the socket error handler.
            }
        },

        /**
         * Close the connection without reporting a failure. Idempotent.
         * @returns {void}
         */
        close: finish,
    };
}

module.exports = {
    describeSocketError,
    openNtripTransport,
    MAX_HEADER_BYTES,
    USER_AGENT,
    BUSY_STATUS_CODES,
};
