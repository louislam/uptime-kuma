const net = require("net");
const tls = require("tls");
const { domainToASCII } = require("url");
const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");

const DEFAULT_EXIT_IP_CHECK_URL = "https://api.ipify.org";
const EXIT_IP_RESPONSE_LIMIT = 1024;

const SOCKS5_REPLY_MESSAGES = {
    0x01: "general SOCKS server failure",
    0x02: "connection not allowed by ruleset",
    0x03: "network unreachable",
    0x04: "target host unreachable",
    0x05: "target connection refused",
    0x06: "TTL expired",
    0x07: "command not supported",
    0x08: "address type not supported",
};

class Socks5MonitorType extends MonitorType {
    name = "socks5";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        validateSocks5Monitor(monitor);
        const hasCredentials = Boolean(monitor.socks5Username) && Boolean(monitor.socks5Password);
        const socket = net.createConnection({
            host: monitor.hostname,
            port: monitor.port,
            family: 4,
        });
        let timeoutID;
        const deadline = new Promise((_, reject) => {
            timeoutID = setTimeout(() => {
                socket.destroy();
                reject(new Error("SOCKS5 proxy connection timed out"));
            }, monitor.timeout * 1000);
        });

        try {
            await Promise.race([this.runCheck(socket, monitor, heartbeat, hasCredentials), deadline]);
        } finally {
            clearTimeout(timeoutID);
            socket.destroy();
        }
    }

    /**
     * Execute the protocol within the deadline established by check().
     * @param {net.Socket} socket Connected proxy socket
     * @param {object} monitor Monitor configuration
     * @param {object} heartbeat Heartbeat result
     * @param {boolean} hasCredentials Whether RFC 1929 auth is required
     * @returns {Promise<void>}
     */
    async runCheck(socket, monitor, heartbeat, hasCredentials) {
        await waitForConnection(socket);
        socket.write(Buffer.from([0x05, 0x01, hasCredentials ? 0x02 : 0x00]));

        const response = await readExactly(socket, 2);
        if (response[0] !== 0x05) {
            throw new Error("SOCKS5 negotiation failed: invalid protocol version");
        }
        if (response[1] !== (hasCredentials ? 0x02 : 0x00)) {
            throw new Error(
                hasCredentials
                    ? "SOCKS5 negotiation failed: proxy does not accept username/password authentication"
                    : "SOCKS5 negotiation failed: proxy does not accept no authentication"
            );
        }

        if (hasCredentials) {
            const username = Buffer.from(monitor.socks5Username, "utf8");
            const password = Buffer.from(monitor.socks5Password, "utf8");
            socket.write(
                Buffer.concat([
                    Buffer.from([0x01, username.length]),
                    username,
                    Buffer.from([password.length]),
                    password,
                ])
            );

            const authResponse = await readExactly(socket, 2);
            if (authResponse[0] !== 0x01) {
                throw new Error("SOCKS5 authentication failed: invalid authentication version");
            }
            if (authResponse[1] !== 0x00) {
                throw new Error("SOCKS5 username or password authentication failed");
            }
        }

        if (monitor.socks5CheckMode === "connect") {
            socket.write(buildConnectRequest(monitor.socks5TargetHost, monitor.socks5TargetPort));
            await readConnectResponse(socket);
            heartbeat.status = UP;
            heartbeat.msg = "SOCKS5 proxy connection successful";
            return;
        }

        if (monitor.socks5CheckMode === "exit-ip") {
            const checkUrl = getExitIpCheckUrl(monitor);
            const port = checkUrl.port ? Number(checkUrl.port) : checkUrl.protocol === "https:" ? 443 : 80;
            socket.write(buildConnectRequest(checkUrl.hostname, port));
            await readConnectResponse(socket);
            const body = await requestExitIp(socket, checkUrl);
            const exitIP = body.trim();

            if (!net.isIPv4(exitIP)) {
                throw new Error("Exit IP check returned a non-IPv4 response");
            }

            if (exitIP !== monitor.hostname) {
                throw new Error(`Exit IP mismatch: expected ${monitor.hostname}, got ${exitIP}`);
            }

            heartbeat.status = UP;
            heartbeat.msg = `SOCKS5 exit IP check successful: ${exitIP}`;
            return;
        }

        heartbeat.status = UP;
        heartbeat.msg = "SOCKS5 handshake and authentication successful";
    }
}

/**
 * Validate SOCKS5 monitor configuration before opening a network connection.
 * @param {object} monitor Monitor configuration
 * @returns {void}
 * @throws {Error} If the monitor configuration is invalid
 */
function validateSocks5Monitor(monitor) {
    if (!isValidHost(monitor.hostname)) {
        throw new Error("SOCKS5 proxy host must be a valid hostname or IPv4 address");
    }
    validatePort(monitor.port, "SOCKS5 proxy port");

    const hasUsername = monitor.socks5Username != null && monitor.socks5Username !== "";
    const hasPassword = monitor.socks5Password != null && monitor.socks5Password !== "";
    if (hasUsername !== hasPassword) {
        throw new Error("SOCKS5 username and password must be provided together");
    }
    if (hasUsername) {
        validateCredential(monitor.socks5Username, "username");
        validateCredential(monitor.socks5Password, "password");
    }

    if (!["handshake", "connect", "exit-ip"].includes(monitor.socks5CheckMode)) {
        throw new Error("SOCKS5 check mode must be handshake, connect, or exit-ip");
    }
    if (monitor.socks5CheckMode === "connect") {
        if (!monitor.socks5TargetHost || monitor.socks5TargetPort == null) {
            throw new Error("SOCKS5 target host and port are required in connect mode");
        }
        if (!isValidHost(monitor.socks5TargetHost)) {
            throw new Error("SOCKS5 target host must be a valid hostname or IPv4 address");
        }
        validatePort(monitor.socks5TargetPort, "SOCKS5 target port");
    }
    if (monitor.socks5CheckMode === "exit-ip") {
        if (!net.isIPv4(monitor.hostname)) {
            throw new Error("SOCKS5 proxy host must be an IPv4 address in exit IP check mode");
        }
        getExitIpCheckUrl(monitor);
    }
}

/**
 * @param {string} value Hostname or IPv4 address
 * @returns {boolean} Whether the host is supported
 */
function isValidHost(value) {
    if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
        return false;
    }
    if (net.isIPv6(value) || value.includes(":") || value.includes("/") || /\s/.test(value)) {
        return false;
    }
    if (net.isIPv4(value)) {
        return true;
    }
    const asciiHost = domainToASCII(value);
    if (!asciiHost || asciiHost.length > 253) {
        return false;
    }
    return asciiHost.split(".").every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
}

/**
 * @param {number} value TCP port
 * @param {string} label Field label for errors
 * @returns {void}
 * @throws {Error} If the port is outside the valid TCP range
 */
function validatePort(value, label) {
    if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) {
        throw new Error(`${label} must be between 1 and 65535`);
    }
}

/**
 * @param {string} value Credential value
 * @param {string} label Credential label
 * @returns {void}
 * @throws {Error} If the credential exceeds the RFC 1929 byte limit
 */
function validateCredential(value, label) {
    const byteLength = Buffer.byteLength(value, "utf8");
    if (byteLength < 1 || byteLength > 255) {
        throw new Error(`SOCKS5 ${label} must be between 1 and 255 UTF-8 bytes`);
    }
}

/**
 * Wait for a socket connection. The caller applies one deadline to the whole check.
 * @param {net.Socket} socket Socket to connect
 * @returns {Promise<void>} Resolves after the connection is established
 */
function waitForConnection(socket) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            socket.off("connect", onConnect);
            socket.off("error", onError);
        };
        const onConnect = () => {
            cleanup();
            resolve();
        };
        const onError = (error) => {
            cleanup();
            reject(new Error(`SOCKS5 proxy connection failed: ${error.message}`));
        };

        socket.once("connect", onConnect);
        socket.once("error", onError);
    });
}

/**
 * Read an exact number of bytes without assuming TCP packet boundaries.
 * @param {net.Socket} socket Connected socket
 * @param {number} length Number of bytes to read
 * @returns {Promise<Buffer>} Exact response bytes
 */
function readExactly(socket, length) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let received = 0;

        const onData = (chunk) => {
            chunks.push(chunk);
            received += chunk.length;
            if (received >= length) {
                cleanup();
                const data = Buffer.concat(chunks, received);
                if (data.length > length) {
                    socket.pause();
                    socket.unshift(data.subarray(length));
                }
                resolve(data.subarray(0, length));
            }
        };
        const onClose = () => {
            cleanup();
            reject(new Error("SOCKS5 proxy closed the connection unexpectedly"));
        };
        const onError = (error) => {
            cleanup();
            reject(new Error(`SOCKS5 proxy connection failed: ${error.message}`));
        };
        const cleanup = () => {
            socket.off("data", onData);
            socket.off("close", onClose);
            socket.off("error", onError);
        };

        socket.on("data", onData);
        socket.once("close", onClose);
        socket.once("error", onError);
        socket.resume();
    });
}

/**
 * Build a SOCKS5 CONNECT request. Domain names are deliberately sent to the
 * proxy so they are resolved remotely.
 * @param {string} host Target hostname or IPv4 address
 * @param {number} port Target TCP port
 * @returns {Buffer} Encoded SOCKS5 CONNECT request
 */
function buildConnectRequest(host, port) {
    let address;

    if (net.isIPv4(host)) {
        address = Buffer.from([0x01, ...host.split(".").map(Number)]);
    } else {
        const domain = Buffer.from(domainToASCII(host), "ascii");
        address = Buffer.concat([Buffer.from([0x03, domain.length]), domain]);
    }

    return Buffer.concat([Buffer.from([0x05, 0x01, 0x00]), address, Buffer.from([port >> 8, port & 0xff])]);
}

/**
 * @param {object} monitor Monitor configuration
 * @returns {URL} Parsed exit IP check URL
 * @throws {Error} If the URL is not a supported HTTP/HTTPS URL
 */
function getExitIpCheckUrl(monitor) {
    const rawUrl = (monitor.socks5ExitIpCheckUrl || DEFAULT_EXIT_IP_CHECK_URL).trim();
    let checkUrl;

    try {
        checkUrl = new URL(rawUrl);
    } catch (e) {
        throw new Error("SOCKS5 exit IP check URL must be a valid HTTP or HTTPS URL");
    }

    if (!["http:", "https:"].includes(checkUrl.protocol) || !checkUrl.hostname) {
        throw new Error("SOCKS5 exit IP check URL must be a valid HTTP or HTTPS URL");
    }

    return checkUrl;
}

/**
 * Request the configured exit IP endpoint through an established SOCKS5 CONNECT tunnel.
 * @param {net.Socket} socket Connected SOCKS5 tunnel socket
 * @param {URL} checkUrl Exit IP check URL
 * @returns {Promise<string>} Plain text response body
 */
async function requestExitIp(socket, checkUrl) {
    const requestSocket = checkUrl.protocol === "https:" ? await connectTls(socket, checkUrl.hostname) : socket;
    const path = `${checkUrl.pathname || "/"}${checkUrl.search || ""}`;
    const hostHeader = checkUrl.port ? `${checkUrl.hostname}:${checkUrl.port}` : checkUrl.hostname;

    requestSocket.write(
        [
            `GET ${path} HTTP/1.1`,
            `Host: ${hostHeader}`,
            "Accept: text/plain",
            "Accept-Encoding: identity",
            "Connection: close",
            "",
            "",
        ].join("\r\n")
    );

    const response = await readHttpResponse(requestSocket, EXIT_IP_RESPONSE_LIMIT);
    if (response.statusCode < 200 || response.statusCode > 299) {
        throw new Error(`Exit IP check request failed: HTTP ${response.statusCode}`);
    }

    return response.body;
}

/**
 * @param {net.Socket} socket Connected tunnel socket
 * @param {string} servername TLS SNI hostname
 * @returns {Promise<tls.TLSSocket>} Connected TLS socket
 */
function connectTls(socket, servername) {
    return new Promise((resolve, reject) => {
        const tlsSocket = tls.connect({
            socket,
            servername,
        });
        const cleanup = () => {
            tlsSocket.off("secureConnect", onSecureConnect);
            tlsSocket.off("error", onError);
        };
        const onSecureConnect = () => {
            cleanup();
            resolve(tlsSocket);
        };
        const onError = (error) => {
            cleanup();
            reject(new Error(`Exit IP check request failed: ${error.message}`));
        };

        tlsSocket.once("secureConnect", onSecureConnect);
        tlsSocket.once("error", onError);
    });
}

/**
 * @param {net.Socket|tls.TLSSocket} socket Connected HTTP socket
 * @param {number} bodyLimit Maximum response body bytes
 * @returns {Promise<{statusCode: number, body: string}>} HTTP status and body
 */
function readHttpResponse(socket, bodyLimit) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let received = 0;

        const cleanup = () => {
            socket.off("data", onData);
            socket.off("end", onEnd);
            socket.off("close", onEnd);
            socket.off("error", onError);
        };
        const onData = (chunk) => {
            chunks.push(chunk);
            received += chunk.length;

            const data = Buffer.concat(chunks, received);
            const headerEnd = data.indexOf("\r\n\r\n");
            if (headerEnd >= 0 && data.length - headerEnd - 4 > bodyLimit) {
                cleanup();
                reject(new Error("Exit IP check response is too large"));
            }
        };
        const onEnd = () => {
            cleanup();
            try {
                resolve(parseHttpResponse(Buffer.concat(chunks, received), bodyLimit));
            } catch (e) {
                reject(e);
            }
        };
        const onError = (error) => {
            cleanup();
            reject(new Error(`Exit IP check request failed: ${error.message}`));
        };

        socket.on("data", onData);
        socket.once("end", onEnd);
        socket.once("close", onEnd);
        socket.once("error", onError);
        socket.resume();
    });
}

/**
 * @param {Buffer} data Raw HTTP response
 * @param {number} bodyLimit Maximum response body bytes
 * @returns {{statusCode: number, body: string}} HTTP status and body
 * @throws {Error} If the response cannot be parsed or is too large
 */
function parseHttpResponse(data, bodyLimit) {
    const headerEnd = data.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
        throw new Error("Exit IP check request failed: invalid HTTP response");
    }

    const headerText = data.subarray(0, headerEnd).toString("latin1");
    const headerLines = headerText.split("\r\n");
    const statusLine = headerLines[0];
    const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(statusLine);
    if (!statusMatch) {
        throw new Error("Exit IP check request failed: invalid HTTP status line");
    }

    const headers = parseHttpHeaders(headerLines.slice(1));
    const body = headers["transfer-encoding"]
        ?.toLowerCase()
        .split(",")
        .map((value) => value.trim())
        .includes("chunked")
        ? decodeChunkedBody(data.subarray(headerEnd + 4), bodyLimit)
        : data.subarray(headerEnd + 4);

    if (body.length > bodyLimit) {
        throw new Error("Exit IP check response is too large");
    }

    return {
        statusCode: Number(statusMatch[1]),
        body: body.toString("utf8"),
    };
}

/**
 * @param {string[]} headerLines HTTP header lines without the status line
 * @returns {object} Lower-case header map
 */
function parseHttpHeaders(headerLines) {
    const headers = {};
    for (const line of headerLines) {
        const separator = line.indexOf(":");
        if (separator <= 0) {
            continue;
        }
        const name = line.slice(0, separator).trim().toLowerCase();
        const value = line.slice(separator + 1).trim();
        headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    }
    return headers;
}

/**
 * Decode a small HTTP chunked response body.
 * @param {Buffer} data Raw chunked body bytes
 * @param {number} bodyLimit Maximum decoded response body bytes
 * @returns {Buffer} Decoded body
 * @throws {Error} If the chunked body is malformed or too large
 */
function decodeChunkedBody(data, bodyLimit) {
    const chunks = [];
    let decodedLength = 0;
    let offset = 0;

    while (offset < data.length) {
        const sizeEnd = data.indexOf("\r\n", offset);
        if (sizeEnd < 0) {
            throw new Error("Exit IP check request failed: invalid chunked response");
        }

        const sizeLine = data.subarray(offset, sizeEnd).toString("latin1").split(";")[0].trim();
        const size = Number.parseInt(sizeLine, 16);
        if (!Number.isFinite(size) || size < 0) {
            throw new Error("Exit IP check request failed: invalid chunked response");
        }

        offset = sizeEnd + 2;
        if (size === 0) {
            return Buffer.concat(chunks, decodedLength);
        }

        if (offset + size + 2 > data.length || data[offset + size] !== 0x0d || data[offset + size + 1] !== 0x0a) {
            throw new Error("Exit IP check request failed: invalid chunked response");
        }

        decodedLength += size;
        if (decodedLength > bodyLimit) {
            throw new Error("Exit IP check response is too large");
        }

        chunks.push(data.subarray(offset, offset + size));
        offset += size + 2;
    }

    throw new Error("Exit IP check request failed: invalid chunked response");
}

/**
 * Read and validate a SOCKS5 CONNECT response without consuming target data.
 * @param {net.Socket} socket Connected socket
 * @returns {Promise<void>}
 */
async function readConnectResponse(socket) {
    const header = await readExactly(socket, 4);
    if (header[0] !== 0x05) {
        throw new Error("SOCKS5 CONNECT failed: invalid protocol version");
    }
    if (header[1] !== 0x00) {
        const message = SOCKS5_REPLY_MESSAGES[header[1]] || `unknown response code ${header[1]}`;
        throw new Error(`SOCKS5 CONNECT failed: ${message}`);
    }

    switch (header[3]) {
        case 0x01:
            await readExactly(socket, 6);
            break;
        case 0x03: {
            const domainLength = (await readExactly(socket, 1))[0];
            await readExactly(socket, domainLength + 2);
            break;
        }
        case 0x04:
            // BND.ADDR describes the proxy-side socket and may be IPv6 even
            // though configured proxy and target addresses are not.
            await readExactly(socket, 18);
            break;
        default:
            throw new Error("SOCKS5 CONNECT failed: invalid address type");
    }
}

module.exports = {
    Socks5MonitorType,
    DEFAULT_EXIT_IP_CHECK_URL,
    validateSocks5Monitor,
};
