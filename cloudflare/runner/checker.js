/* eslint-disable jsdoc/require-jsdoc */
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");

const DOWN = 0;
const UP = 1;
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_TWINGATE_PROXY_URL = "http://127.0.0.1:9999";

async function runCheck(job) {
    const monitor = job.monitor || {};
    const networkProfile = job.networkProfile || null;
    const twingateProxyUrl = job.twingateProxyUrl || process.env.TWINGATE_PROXY_URL || DEFAULT_TWINGATE_PROXY_URL;
    const start = Date.now();

    try {
        if (isTwingateProfile(networkProfile) && monitor.type === "ping") {
            throw new Error(
                "ICMP ping is not supported through Twingate userspace mode. Use a TCP Port monitor for Cloudflare-hosted Twingate checks."
            );
        }

        if (["http", "keyword", "json-query"].includes(monitor.type)) {
            return await runHttpCheck(monitor, networkProfile, twingateProxyUrl, start);
        }

        if (monitor.type === "port") {
            return await runTcpCheck(monitor, networkProfile, twingateProxyUrl, start);
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

async function runHttpCheck(monitor, networkProfile, twingateProxyUrl, start) {
    const targetUrl = new URL(monitor.url);
    const response = isTwingateProfile(networkProfile)
        ? await requestViaHttpProxy(targetUrl, twingateProxyUrl, monitor)
        : await requestDirect(targetUrl, monitor);

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
        response: response.body,
    };
}

async function runTcpCheck(monitor, networkProfile, twingateProxyUrl, start) {
    const hostname = monitor.hostname;
    const port = Number(monitor.port);

    if (!hostname || !port) {
        throw new Error("TCP monitor requires hostname and port");
    }

    if (isTwingateProfile(networkProfile)) {
        const socket = await connectViaHttpProxy(hostname, port, twingateProxyUrl, monitor.timeout);
        socket.end();
    } else {
        await connectDirect(hostname, port, monitor.timeout);
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

function requestDirect(targetUrl, monitor) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.protocol === "https:" ? https : http;
        const req = client.request(
            targetUrl,
            {
                method: monitor.method || "GET",
                timeout: getTimeoutMs(monitor.timeout),
                headers: parseHeaders(monitor.headers),
            },
            (res) => collectResponse(res, resolve)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

function requestViaHttpProxy(targetUrl, proxyUrlString, monitor) {
    if (targetUrl.protocol === "https:") {
        return requestHttpsViaConnectProxy(targetUrl, proxyUrlString, monitor);
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
            (res) => collectResponse(res, resolve)
        );
        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        if (monitor.body) {
            req.write(monitor.body);
        }
        req.end();
    });
}

async function requestHttpsViaConnectProxy(targetUrl, proxyUrlString, monitor) {
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
            (res) => collectResponse(res, resolve)
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

function collectResponse(res, resolve) {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
        resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage || "OK",
            body: Buffer.concat(chunks).toString("utf8"),
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

function getTimeoutMs(timeoutSeconds) {
    return Number(timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000;
}

module.exports = {
    runCheck,
    runHttpCheck,
    runTcpCheck,
    isTwingateProfile,
};
