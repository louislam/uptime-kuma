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
const DEFAULT_TWINGATE_PING_FALLBACK_PORTS = [80, 443];
const MAX_TWINGATE_PING_FALLBACK_PORTS = 10;
const SYSTEM_TWINGATE_PROXY_URL = "http://127.0.0.1:9999";
const PRIVATE_WORKER_HOST_ERROR =
    "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts";
const execFileAsync = promisify(execFile);

async function runCheck(job) {
    const monitor = job.monitor || {};
    const networkProfile = job.networkProfile || null;
    const twingateProxyUrl = resolveTwingateProxyUrl(job);
    const start = Date.now();
    const options = {
        lookup: typeof job.lookup === "function" ? job.lookup : dns.lookup,
        allowPrivateResolvedForTest: job.allowPrivateResolvedForTest === true,
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
            return await runPingCheck(monitor, start, execFileAsync, Date.now, networkProfile, options);
        }

        if (monitor.type === "websocket-upgrade") {
            return await runWebSocketReachabilityCheck(monitor, networkProfile, twingateProxyUrl, start);
        }

        throw new Error(`Unsupported Cloudflare runner monitor type: ${monitor.type}`);
    } catch (error) {
        return {
            status: DOWN,
            ping: Date.now() - start,
            msg: error.message,
            response: null,
        };
    }
}

async function runHttpCheck(monitor, networkProfile, twingateProxyUrl, start, options = {}) {
    const targetUrl = new URL(monitor.url);
    const useTwingateProxy = isTwingateProfile(networkProfile);
    const userProxy = useTwingateProxy ? null : activeUserProxy(monitor.proxy);
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
        const parsed = JSON.parse(response.body);
        const actual = resolveJsonPath(parsed, monitor.jsonPath);
        if (String(actual) !== String(monitor.expectedValue)) {
            throw new Error(`JSON query does not match expected value: ${actual}`);
        }
    }

    return {
        status: UP,
        ping: Date.now() - start,
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

    if (isTwingateProfile(networkProfile)) {
        const socket = await connectViaHttpProxy(hostname, port, twingateProxyUrl, monitor.timeout);
        socket.end();
    } else {
        const resolvedTarget = await resolveDirectTarget(hostname, networkProfile, options.lookup, options);
        await connectDirect(resolvedTarget.address || hostname, port, monitor.timeout);
    }

    const ping = Date.now() - start;
    return {
        status: UP,
        ping,
        msg: `${ping} ms`,
        response: null,
    };
}

async function runWebSocketReachabilityCheck(monitor, networkProfile, twingateProxyUrl, start) {
    const url = new URL(monitor.url);
    const port = Number(url.port || (url.protocol === "wss:" ? 443 : 80));
    const tcpMonitor = {
        hostname: url.hostname,
        port,
        timeout: monitor.timeout,
    };
    return await runTcpCheck(tcpMonitor, networkProfile, twingateProxyUrl, start);
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
    const ping = parseAveragePing(output) ?? now() - start;

    return {
        status: UP,
        ping,
        msg: `${ping} ms`,
        response: null,
    };
}

async function runTwingateUserspacePingCheck(monitor, twingateProxyUrl, start, fallbackPorts) {
    const hostname = monitor.hostname;
    if (!hostname) {
        throw new Error("Ping monitor requires hostname");
    }

    const ports = normalizePortList(fallbackPorts);
    if (ports.length === 0) {
        throw new Error("Twingate userspace ping requires at least one TCP fallback port");
    }

    const timeoutSeconds = resolveTwingatePingFallbackTimeoutSeconds(monitor);
    const attempts = ports.map(async (port) => {
        try {
            const socket = await connectViaHttpProxy(hostname, port, twingateProxyUrl, timeoutSeconds);
            socket.end();
            return { port };
        } catch (error) {
            throw new Error(`${port}: ${error.message}`);
        }
    });

    try {
        const result = await Promise.any(attempts);
        const ping = Date.now() - start;
        return {
            status: UP,
            ping,
            msg: `${ping} ms (TCP ${result.port} via Twingate)`,
            response: null,
        };
    } catch (error) {
        const details = summarizeTwingatePingFallbackErrors(error);
        throw new Error(
            `Twingate userspace ping could not connect to ${hostname} on TCP ports ${ports.join(", ")}${details}`
        );
    }
}

function parseAveragePing(output) {
    const match = output.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)(?:\/([\d.]+))?\s*ms/i);
    return match ? Number(match[2]) : null;
}

function requestDirect(targetUrl, monitor, resolvedTarget = null, responseMaxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.protocol === "https:" ? https : http;
        const req = client.request(
            targetUrl,
            {
                method: monitor.method || "GET",
                timeout: getTimeoutMs(monitor.timeout),
                headers: parseHeaders(monitor.headers),
                lookup: pinnedLookup(resolvedTarget),
            },
            (res) => collectResponse(res, resolve, responseMaxBytes)
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
            (res) => collectResponse(res, resolve, responseMaxBytes)
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
        const req = transport.request(
            {
                hostname: targetUrl.hostname,
                port: Number(targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80)),
                method: monitor.method || "GET",
                path: `${targetUrl.pathname}${targetUrl.search}`,
                timeout: getTimeoutMs(monitor.timeout),
                headers: parseHeaders(monitor.headers),
                agent: createUserProxyAgent(proxy, targetUrl.protocol),
            },
            (res) => collectResponse(res, resolve, responseMaxBytes)
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
    const proxyUrl = proxyToUrl(proxy);
    if (String(proxy.protocol || "").startsWith("socks")) {
        return new SocksProxyAgent(proxyUrl);
    }
    return targetProtocol === "https:"
        ? new HttpsProxyAgent(proxyUrl)
        : new HttpProxyAgent(proxyUrl);
}

function proxyToUrl(proxy) {
    const proxyUrl = new URL(`${proxy.protocol}://${proxy.host}:${proxy.port}`);
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
            (res) => collectResponse(res, resolve, responseMaxBytes)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
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

function collectResponse(res, resolve, maxBytes = DEFAULT_RESPONSE_MAX_BYTES) {
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
        job.twingatePingFallbackPorts ??
        process.env.TWINGATE_PING_FALLBACK_PORTS;
    if (explicitPorts === undefined || explicitPorts === null || explicitPorts === "") {
        return DEFAULT_TWINGATE_PING_FALLBACK_PORTS;
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
