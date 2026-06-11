/* eslint-disable jsdoc/require-jsdoc */
const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns").promises;
const net = require("node:net");
const tls = require("node:tls");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");

const DOWN = 0;
const UP = 1;
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_PING_COUNT = 1;
const DEFAULT_PING_PACKET_SIZE = 56;
const DEFAULT_PING_PER_REQUEST_TIMEOUT_SECONDS = 2;
const DEFAULT_RESPONSE_MAX_BYTES = 1024;
const MAX_RESPONSE_MAX_BYTES = 64 * 1024;
const DEFAULT_TWINGATE_PING_FALLBACK_PORTS = [];
const MAX_TWINGATE_PING_FALLBACK_PORTS = 10;
const SYSTEM_TWINGATE_PROXY_URL = "http://127.0.0.1:9999";
const PRIVATE_WORKER_HOST_ERROR =
    "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts";
const TWINGATE_USERSPACE_TCP_UNVERIFIED_MESSAGE =
    "Twingate userspace TCP checks require TUN mode to verify endpoint liveness";
const TWINGATE_USERSPACE_PING_UNSUPPORTED_MESSAGE =
    "Twingate userspace mode cannot run ICMP ping. Enable TUN mode or configure verifiable TCP fallback ports.";
const execFileAsync = promisify(execFile);

async function runCheck(job) {
    const monitor = job.monitor || {};
    const networkProfile = job.networkProfile || null;
    const twingateProxyUrl = resolveTwingateProxyUrl(job);
    const now = typeof job.now === "function" ? job.now : Date.now;
    const start = now();
    const options = {
        lookup: typeof job.lookup === "function" ? job.lookup : dns.lookup,
        allowPrivateResolvedForTest: job.allowPrivateResolvedForTest === true,
        execFile: typeof job.execFile === "function" ? job.execFile : execFileAsync,
        now,
        twingateTunMode: normalizeTwingateTunMode(job.twingateTunMode),
    };

    try {
        if (isTwingateProfile(networkProfile) && monitor.type === "ping" && job.twingateTunMode === "off") {
            return await runTwingateUserspacePingCheck(
                monitor,
                twingateProxyUrl,
                start,
                resolveTwingatePingFallbackPorts(job, monitor)
            );
        }

        if (["http", "keyword", "json-query"].includes(monitor.type)) {
            return await runHttpCheck(monitor, networkProfile, twingateProxyUrl, start, options);
        }

        if (monitor.type === "port") {
            return await runTcpCheck(monitor, networkProfile, twingateProxyUrl, start, options);
        }

        if (monitor.type === "ping") {
            return await runPingCheck(monitor, start, options.execFile, options.now, networkProfile, options);
        }

        if (monitor.type === "websocket-upgrade") {
            return await runWebSocketReachabilityCheck(monitor, networkProfile, twingateProxyUrl, start, options);
        }

        throw new Error(`Unsupported Cloudflare runner monitor type: ${monitor.type}`);
    } catch (error) {
        return {
            status: DOWN,
            ping: options.now() - start,
            msg: error.message,
            response: null,
        };
    }
}

async function runHttpCheck(monitor, networkProfile, twingateProxyUrl, start, options = {}) {
    const targetUrl = new URL(monitor.url);
    const useTwingateProxy = shouldUseTwingateProxy(networkProfile, options);
    const userProxy = useTwingateProxy ? null : activeUserProxy(monitor.proxy);
    const now = typeof options.now === "function" ? options.now : Date.now;
    let resolvedTarget = null;
    if (!useTwingateProxy && !userProxy) {
        resolvedTarget = await resolveDirectTarget(targetUrl.hostname, networkProfile, options.lookup, options);
    }
    const responseMaxBytes = resolveResponseMaxBytes(monitor);
    const response = useTwingateProxy
        ? await requestViaHttpProxy(targetUrl, twingateProxyUrl, monitor, responseMaxBytes)
        : userProxy
            ? await requestViaUserProxy(targetUrl, userProxy, monitor, responseMaxBytes)
            : await requestDirect(targetUrl, monitor, resolvedTarget, responseMaxBytes);

    const statusOk = response.statusCode >= 200 && response.statusCode < 400;
    if (!statusOk) {
        throw new Error(`${response.statusCode} - ${response.statusMessage}`);
    }

    if (monitor.type === "keyword") {
        const keyword = monitor.keyword || "";
        const hasKeyword = response.body.includes(keyword);
        const inverted = Boolean(monitor.invertKeyword);
        if ((!inverted && !hasKeyword) || (inverted && hasKeyword)) {
            throw new Error(inverted ? "Keyword is found" : "Keyword is not found");
        }
    }

    if (monitor.type === "json-query" && monitor.expectedValue !== undefined && monitor.expectedValue !== null) {
        let parsed;
        try {
            parsed = JSON.parse(response.body);
        } catch (_) {
            throw new Error(`Response body is not valid JSON${response.truncated ? " (body truncated by size limit)" : ""}`);
        }
        const actual = resolveJsonPath(parsed, monitor.jsonPath);
        if (String(actual) !== String(monitor.expectedValue)) {
            throw new Error(`JSON query does not match expected value: ${actual}`);
        }
    }

    return {
        status: UP,
        ping: now() - start,
        msg: `${response.statusCode} - ${response.statusMessage}`,
        response: shouldReturnResponseBody(monitor, true) ? response.body : null,
    };
}

async function runTcpCheck(monitor, networkProfile, twingateProxyUrl, start, options = {}) {
    const hostname = monitor.hostname;
    const port = Number(monitor.port);

    if (!hostname || !port) {
        throw new Error("TCP monitor requires hostname and port");
    }

    if (shouldUseTwingateProxy(networkProfile, options)) {
        await verifyTwingateUserspaceTcpCheck(hostname, port, twingateProxyUrl, monitor.timeout);
    } else {
        const resolvedTarget = await resolveDirectTarget(hostname, networkProfile, options.lookup, options);
        await connectDirect(resolvedTarget.address || hostname, port, monitor.timeout);
    }

    const now = typeof options.now === "function" ? options.now : Date.now;
    const ping = now() - start;
    return {
        status: UP,
        ping,
        msg: `${ping} ms`,
        response: null,
    };
}

async function runWebSocketReachabilityCheck(monitor, networkProfile, twingateProxyUrl, start, options = {}) {
    const url = new URL(monitor.url);
    const port = Number(url.port || (url.protocol === "wss:" ? 443 : 80));
    const tcpMonitor = {
        hostname: url.hostname,
        port,
        timeout: monitor.timeout,
    };
    return await runTcpCheck(tcpMonitor, networkProfile, twingateProxyUrl, start, options);
}

async function runPingCheck(
    monitor,
    start,
    execFileFn = execFileAsync,
    now = Date.now,
    networkProfile = null,
    options = {}
) {
    const hostname = monitor.hostname;
    if (!hostname) {
        throw new Error("Ping monitor requires hostname");
    }
    const args = [
        "-c",
        String(toPositiveInteger(monitor.ping_count, DEFAULT_PING_COUNT)),
        "-W",
        String(toPositiveInteger(monitor.ping_per_request_timeout, DEFAULT_PING_PER_REQUEST_TIMEOUT_SECONDS)),
        "-w",
        String(toPositiveInteger(monitor.timeout, DEFAULT_TIMEOUT_SECONDS)),
        "-s",
        String(toPositiveInteger(monitor.packetSize, DEFAULT_PING_PACKET_SIZE)),
    ];

    if (monitor.ping_numeric !== false) {
        args.push("-n");
    }
    args.push(hostname);

    const result = await execFileFn("ping", args);
    const output = String(result.stdout || "");
    const receivedPackets = parseReceivedPingPackets(output);
    if (receivedPackets !== null && receivedPackets <= 0) {
        throw new Error("Ping failed: 0 packets received");
    }

    const averagePing = parseAveragePing(output);
    if (receivedPackets === null && averagePing === null) {
        throw new Error("Ping failed: no ICMP response found");
    }

    const ping = averagePing ?? now() - start;

    return {
        status: UP,
        ping,
        msg: `${ping} ms`,
        response: null,
    };
}

async function runTwingateUserspacePingCheck(monitor, twingateProxyUrl, start, fallbackPorts, options = {}) {
    const hostname = monitor.hostname;
    if (!hostname) {
        throw new Error("Ping monitor requires hostname");
    }

    const ports = normalizePortList(fallbackPorts);
    if (ports.length === 0) {
        throw new Error(TWINGATE_USERSPACE_PING_UNSUPPORTED_MESSAGE);
    }

    const timeoutSeconds = resolveTwingatePingFallbackTimeoutSeconds(monitor);
    const probeTwingatePingPortFn = typeof options.probeTwingatePingPort === "function"
        ? options.probeTwingatePingPort
        : probeTwingatePingPort;
    const now = typeof options.now === "function" ? options.now : Date.now;
    const attempts = ports.map(async (port) => {
        try {
            const probe = await probeTwingatePingPortFn(hostname, port, twingateProxyUrl, timeoutSeconds);
            if (!probe?.verified) {
                throw new Error(probe?.reason || "target liveness was not verified");
            }
            return { port };
        } catch (error) {
            throw new Error(`${port}: ${error.message}`);
        }
    });

    try {
        const result = await Promise.any(attempts);
        const ping = now() - start;
        return {
            status: UP,
            ping,
            msg: `${ping} ms (TCP ${result.port} via Twingate)`,
            response: null,
        };
    } catch (error) {
        const details = summarizeTwingatePingFallbackErrors(error);
        throw new Error(
            `Twingate userspace ping could not verify ${hostname} on TCP ports ${ports.join(", ")}${details}`
        );
    }
}

function parseAveragePing(output) {
    const match = output.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)(?:\/([\d.]+))?\s*ms/i);
    return match ? Number(match[2]) : null;
}

function parseReceivedPingPackets(output) {
    const match = output.match(/\b\d+\s+packets?\s+transmitted,\s+(\d+)\s+(?:packets?\s+)?received\b/i);
    return match ? Number(match[1]) : null;
}

function requestDirect(targetUrl, monitor, resolvedTarget = null, responseMaxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.protocol === "https:" ? https : http;
        const tlsOptions = targetUrl.protocol === "https:" ? monitorTlsOptions(monitor) : {};
        const req = client.request(
            targetUrl,
            {
                method: monitor.method || "GET",
                timeout: getTimeoutMs(monitor.timeout),
                headers: parseHeaders(monitor.headers),
                lookup: pinnedLookup(resolvedTarget),
                ...tlsOptions,
            },
            (res) => collectResponse(res, resolve, reject, responseMaxBytes)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

function requestViaHttpProxy(targetUrl, proxyUrlString, monitor, responseMaxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
    if (targetUrl.protocol === "https:") {
        return requestHttpsViaConnectProxy(targetUrl, proxyUrlString, monitor, responseMaxBytes);
    }

    return new Promise((resolve, reject) => {
        const proxyUrl = new URL(proxyUrlString);
        const req = http.request(
            {
                hostname: proxyUrl.hostname,
                port: Number(proxyUrl.port || 80),
                method: monitor.method || "GET",
                path: targetUrl.toString(),
                timeout: getTimeoutMs(monitor.timeout),
                headers: {
                    ...parseHeaders(monitor.headers),
                    Host: targetUrl.host,
                },
            },
            (res) => collectResponse(res, resolve, reject, responseMaxBytes)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

function requestViaUserProxy(targetUrl, proxy, monitor, responseMaxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
    return new Promise((resolve, reject) => {
        const transport = targetUrl.protocol === "https:" ? https : http;
        const tlsOptions = targetUrl.protocol === "https:" ? monitorTlsOptions(monitor) : {};
        const req = transport.request(
            {
                hostname: targetUrl.hostname,
                port: Number(targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80)),
                method: monitor.method || "GET",
                path: `${targetUrl.pathname}${targetUrl.search}`,
                timeout: getTimeoutMs(monitor.timeout),
                headers: parseHeaders(monitor.headers),
                agent: createUserProxyAgent(proxy, targetUrl.protocol),
                ...tlsOptions,
            },
            (res) => collectResponse(res, resolve, reject, responseMaxBytes)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

function createUserProxyAgent(proxy, targetProtocol) {
    if (String(proxy.protocol || "").startsWith("socks")) {
        const proxyUrl = proxyToUrl(proxy);
        return new SocksProxyAgent(proxyUrl);
    }
    const proxyUrl = proxyToUrl(proxy, resolveHttpUserProxyProtocol(proxy));
    return targetProtocol === "https:"
        ? new HttpsProxyAgent(proxyUrl)
        : new HttpProxyAgent(proxyUrl);
}

function resolveHttpUserProxyProtocol(proxy) {
    const protocol = String(proxy?.protocol || "http").toLowerCase();
    if (protocol === "https" && net.isIP(String(proxy?.host || ""))) {
        return "http";
    }
    return protocol;
}

function proxyToUrl(proxy, protocol = proxy.protocol) {
    const proxyUrl = new URL(`${protocol}://${proxy.host}:${proxy.port}`);
    if (proxy.auth) {
        proxyUrl.username = proxy.username || "";
        proxyUrl.password = proxy.password || "";
    }
    return proxyUrl.toString();
}

async function requestHttpsViaConnectProxy(
    targetUrl,
    proxyUrlString,
    monitor,
    responseMaxBytes = DEFAULT_RESPONSE_MAX_BYTES
) {
    const socket = await connectViaHttpProxy(
        targetUrl.hostname,
        Number(targetUrl.port || 443),
        proxyUrlString,
        monitor.timeout
    );
    const tlsSocket = tls.connect({
        socket,
        servername: targetUrl.hostname,
        ...monitorTlsOptions(monitor),
    });

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                host: targetUrl.hostname,
                port: Number(targetUrl.port || 443),
                path: `${targetUrl.pathname}${targetUrl.search}`,
                method: monitor.method || "GET",
                createConnection: () => tlsSocket,
                headers: parseHeaders(monitor.headers),
                timeout: getTimeoutMs(monitor.timeout),
            },
            (res) => collectResponse(res, resolve, reject, responseMaxBytes)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

function monitorTlsOptions(monitor) {
    return ignoreTlsErrors(monitor) ? { rejectUnauthorized: false } : {};
}

function ignoreTlsErrors(monitor) {
    return (
        monitor?.ignoreTls === true ||
        monitor?.ignoreTls === 1 ||
        monitor?.ignoreTls === "1" ||
        monitor?.ignoreTls === "true"
    );
}

function connectDirect(hostname, port, timeoutSeconds) {
    return new Promise((resolve, reject) => {
        const socket = net.connect({ host: hostname, port });
        const timeout = setTimeout(() => {
            socket.destroy(new Error("Connection timed out"));
        }, getTimeoutMs(timeoutSeconds));
        socket.once("connect", () => {
            clearTimeout(timeout);
            socket.end();
            resolve();
        });
        socket.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function connectViaHttpProxy(hostname, port, proxyUrlString, timeoutSeconds) {
    return new Promise((resolve, reject) => {
        const proxyUrl = new URL(proxyUrlString);
        const socket = net.connect({
            host: proxyUrl.hostname,
            port: Number(proxyUrl.port || 80),
        });
        let buffer = "";
        const timeout = setTimeout(() => {
            socket.destroy(new Error("Proxy CONNECT timed out"));
        }, getTimeoutMs(timeoutSeconds));

        socket.once("connect", () => {
            socket.write(`CONNECT ${hostname}:${port} HTTP/1.1\r\nHost: ${hostname}:${port}\r\n\r\n`);
        });

        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            if (!buffer.includes("\r\n\r\n")) {
                return;
            }
            clearTimeout(timeout);
            const statusLine = buffer.split("\r\n")[0];
            const match = statusLine.match(/^HTTP\/1\.[01] (\d{3})/);
            const statusCode = match ? Number(match[1]) : 0;
            if (statusCode >= 200 && statusCode < 300) {
                socket.removeAllListeners("data");
                socket.removeAllListeners("error");
                resolve(socket);
            } else {
                socket.destroy();
                reject(new Error(`Twingate proxy rejected CONNECT with ${statusCode || "invalid response"}`));
            }
        });

        socket.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function probeTwingatePingPort(hostname, port, proxyUrlString, timeoutSeconds) {
    const socket = await connectViaHttpProxy(hostname, port, proxyUrlString, timeoutSeconds);
    if (Number(port) === 80) {
        return await verifyHttpTunnelResponse(socket, hostname, timeoutSeconds);
    }
    if (Number(port) === 443) {
        return await verifyTlsTunnelHandshake(socket, hostname, timeoutSeconds);
    }

    // CONNECT success alone can be local proxy readiness. Without a protocol probe, raw TCP fallback is not endpoint proof.
    socket.destroy();
    return {
        verified: false,
        reason: `TCP fallback port ${port} cannot verify target liveness without a protocol probe`,
    };
}

async function verifyTwingateUserspaceTcpCheck(hostname, port, proxyUrlString, timeoutSeconds) {
    // Arbitrary TCP checks need TUN mode so the runner observes the real target connect result instead of proxy acceptance.
    const socket = await connectViaHttpProxy(hostname, port, proxyUrlString, timeoutSeconds);
    socket.destroy();
    throw new Error(TWINGATE_USERSPACE_TCP_UNVERIFIED_MESSAGE);
}

function verifyHttpTunnelResponse(socket, hostname, timeoutSeconds) {
    return new Promise((resolve) => {
        let settled = false;
        let timer;
        const noResponseReason = "CONNECT accepted but target did not return an HTTP response";
        const cleanup = () => {
            clearTimeout(timer);
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            socket.removeListener("end", onNoResponse);
            socket.removeListener("close", onNoResponse);
        };
        const finish = (result, destroy = false) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            if (destroy) {
                socket.destroy();
            } else if (!socket.destroyed) {
                socket.end();
            }
            resolve(result);
        };
        const onData = () => finish({ verified: true });
        const onError = (error) => finish({
            verified: false,
            reason: `CONNECT accepted but target stream failed: ${error.message}`,
        }, true);
        const onNoResponse = () => finish({ verified: false, reason: noResponseReason });

        socket.once("data", onData);
        socket.once("error", onError);
        socket.once("end", onNoResponse);
        socket.once("close", onNoResponse);
        timer = setTimeout(() => finish({ verified: false, reason: noResponseReason }, true), getTimeoutMs(timeoutSeconds));

        try {
            socket.write(`HEAD / HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`);
        } catch (error) {
            finish({
                verified: false,
                reason: `CONNECT accepted but HTTP probe failed: ${error.message}`,
            }, true);
        }
    });
}

function verifyTlsTunnelHandshake(socket, hostname, timeoutSeconds) {
    return new Promise((resolve) => {
        let tlsSocket;
        let settled = false;
        let timer;
        const handshakeReason = "CONNECT accepted but target did not complete TLS handshake";
        const cleanup = () => {
            clearTimeout(timer);
            if (!tlsSocket) {
                return;
            }
            tlsSocket.removeListener("error", onError);
            tlsSocket.removeListener("end", onNoHandshake);
            tlsSocket.removeListener("close", onNoHandshake);
        };
        const finish = (result, destroy = false) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            const activeSocket = tlsSocket || socket;
            if (destroy) {
                activeSocket.destroy();
            } else if (!activeSocket.destroyed) {
                activeSocket.end();
            }
            resolve(result);
        };
        const onError = (error) => finish({
            verified: false,
            reason: `${handshakeReason}: ${error.message}`,
        }, true);
        const onNoHandshake = () => finish({ verified: false, reason: handshakeReason }, true);

        try {
            tlsSocket = tls.connect({
                socket,
                servername: hostname,
                rejectUnauthorized: false,
            }, () => finish({ verified: true }));
        } catch (error) {
            finish({
                verified: false,
                reason: `${handshakeReason}: ${error.message}`,
            }, true);
            return;
        }

        tlsSocket.once("error", onError);
        tlsSocket.once("end", onNoHandshake);
        tlsSocket.once("close", onNoHandshake);
        timer = setTimeout(() => finish({ verified: false, reason: handshakeReason }, true), getTimeoutMs(timeoutSeconds));
    });
}

function collectResponse(res, resolve, reject, maxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
    const chunks = [];
    let receivedBytes = 0;
    const cappedMaxBytes = Math.max(0, Math.min(maxBytes, MAX_RESPONSE_MAX_BYTES));
    res.on("data", (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (receivedBytes < cappedMaxBytes) {
            chunks.push(buffer.subarray(0, cappedMaxBytes - receivedBytes));
        }
        receivedBytes += buffer.length;
    });
    res.on("end", () => {
        resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage || "OK",
            body: Buffer.concat(chunks).toString("utf8"),
            truncated: receivedBytes > cappedMaxBytes,
        });
    });
    // Without this, a connection reset mid-body emits an unhandled "error"
    // event on the response stream and crashes the runner process.
    res.on("error", (error) => {
        reject(new Error(`Response stream failed: ${error.message}`));
    });
}

function parseHeaders(headers) {
    if (!headers) {
        return {};
    }
    if (typeof headers === "string") {
        return JSON.parse(headers);
    }
    return headers;
}

function resolveJsonPath(value, path) {
    if (!path || path === "$") {
        return value;
    }
    return path
        .replace(/^\$\.?/, "")
        .split(".")
        .filter(Boolean)
        .reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function isTwingateProfile(networkProfile) {
    return networkProfile?.slug === "twingate" || networkProfile?.type === "twingate";
}

function shouldUseTwingateProxy(networkProfile, options = {}) {
    return isTwingateProfile(networkProfile) && normalizeTwingateTunMode(options.twingateTunMode) === "off";
}

function normalizeTwingateTunMode(value) {
    return String(value || "on").toLowerCase() === "off" ? "off" : "on";
}

function activeUserProxy(proxy) {
    if (!proxy || proxy.active === false) {
        return null;
    }
    if (!proxy.protocol || !proxy.host || !proxy.port) {
        return null;
    }
    return proxy;
}

function resolveTwingateProxyUrl(job = {}) {
    return job.twingateProxyUrl || SYSTEM_TWINGATE_PROXY_URL;
}

function resolveTwingatePingFallbackPorts(job = {}, monitor = job.monitor || {}) {
    const explicitPorts =
        monitor.twingatePingFallbackPorts ??
        monitor.twingatePingPorts ??
        job.twingatePingFallbackPorts;
    if (explicitPorts === undefined || explicitPorts === null || explicitPorts === "") {
        return [...DEFAULT_TWINGATE_PING_FALLBACK_PORTS];
    }
    return normalizePortList(explicitPorts);
}

function normalizePortList(value) {
    const values = Array.isArray(value)
        ? value
        : String(value)
            .split(/[,\s]+/)
            .filter(Boolean);
    const seen = new Set();
    const ports = [];
    for (const entry of values) {
        const port = Number(entry);
        if (!Number.isInteger(port) || port < 1 || port > 65535 || seen.has(port)) {
            continue;
        }
        seen.add(port);
        ports.push(port);
        if (ports.length >= MAX_TWINGATE_PING_FALLBACK_PORTS) {
            break;
        }
    }
    return ports;
}

function resolveTwingatePingFallbackTimeoutSeconds(monitor = {}) {
    return Math.min(
        toPositiveInteger(monitor.ping_per_request_timeout, DEFAULT_PING_PER_REQUEST_TIMEOUT_SECONDS),
        toPositiveInteger(monitor.timeout, DEFAULT_TIMEOUT_SECONDS)
    );
}

function summarizeTwingatePingFallbackErrors(error) {
    const errors = Array.isArray(error?.errors) ? error.errors : [];
    if (errors.length === 0) {
        return "";
    }
    return `: ${errors.slice(0, 3).map((entry) => entry.message).join("; ")}`;
}

function getTimeoutMs(timeoutSeconds) {
    return Number(timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000;
}

function toPositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

async function resolveDirectTarget(hostname, networkProfile, lookup = dns.lookup, options = {}) {
    if (isTwingateProfile(networkProfile)) {
        return { hostname };
    }
    if (isPrivateWorkerHost(hostname)) {
        throw new Error(PRIVATE_WORKER_HOST_ERROR);
    }

    if (net.isIP(String(hostname || ""))) {
        return {
            hostname,
            address: hostname,
            family: net.isIP(hostname),
        };
    }

    const lookupResult = await lookup(hostname, { all: true });
    const addresses = Array.isArray(lookupResult) ? lookupResult : [lookupResult];
    if (!options.allowPrivateResolvedForTest) {
        for (const result of addresses) {
            if (isPrivateWorkerHost(result?.address)) {
                throw new Error(PRIVATE_WORKER_HOST_ERROR);
            }
        }
    }
    const first = addresses.find((result) => result?.address);
    return first ? { hostname, address: first.address, family: first.family } : { hostname };
}

function pinnedLookup(resolvedTarget) {
    if (!resolvedTarget?.address) {
        return undefined;
    }
    return (_hostname, options, callback) => {
        const done = typeof options === "function" ? options : callback;
        const family = Number(resolvedTarget.family || net.isIP(resolvedTarget.address));
        if (options?.all) {
            done(null, [{ address: resolvedTarget.address, family }]);
            return;
        }
        done(null, resolvedTarget.address, family);
    };
}

function shouldReturnResponseBody(monitor, statusOk) {
    return statusOk ? monitor.saveResponse === true : monitor.saveErrorResponse === true;
}

function resolveResponseMaxBytes(monitor) {
    const parsed = Number(monitor?.responseMaxLength);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_RESPONSE_MAX_BYTES;
    }
    return Math.max(0, Math.min(Math.trunc(parsed), MAX_RESPONSE_MAX_BYTES));
}

function isPrivateWorkerHost(hostname) {
    const normalized = String(hostname || "").trim().toLowerCase();
    if (
        normalized === "localhost" ||
        normalized.endsWith(".localhost") ||
        normalized === "metadata.google.internal"
    ) {
        return true;
    }

    if (net.isIP(normalized) === 4) {
        const [a, b] = normalized.split(".").map((part) => Number(part));
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    if (net.isIP(normalized) === 6) {
        return (
            normalized === "::1" ||
            normalized === "::" ||
            normalized.startsWith("fc") ||
            normalized.startsWith("fd") ||
            normalized.startsWith("fe80:")
        );
    }

    return false;
}

module.exports = {
    SYSTEM_TWINGATE_PROXY_URL,
    DEFAULT_TWINGATE_PING_FALLBACK_PORTS,
    resolveTwingatePingFallbackPorts,
    resolveTwingateProxyUrl,
    resolveDirectTarget,
    runCheck,
    runHttpCheck,
    runPingCheck,
    runTwingateUserspacePingCheck,
    runTcpCheck,
    isTwingateProfile,
};
