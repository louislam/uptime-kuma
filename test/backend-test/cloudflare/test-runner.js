/* eslint-disable jsdoc/require-jsdoc */
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const DOWN = 0;
const UP = 1;
let servers = [];

describe("Cloudflare monitor runner", () => {
    beforeEach(() => {
        servers = [];
    });

    afterEach(async () => {
        await Promise.all(servers.map((server) => closeServer(server)));
    });

    test("direct HTTP checks reject loopback and do not use the Twingate proxy", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let proxyRequests = 0;
        const proxy = await listen(
            http.createServer((req, res) => {
                proxyRequests++;
                res.writeHead(502);
                res.end("proxy should not be used");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 1,
                type: "http",
                url: "http://127.0.0.1:8080/health",
                timeout: 5,
            },
            networkProfile: null,
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
        });

        assert.strictEqual(result.status, DOWN);
        assert.strictEqual(
            result.msg,
            "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts"
        );
        assert.strictEqual(proxyRequests, 0);
    });

    test("direct HTTP checks reject hostnames that resolve to private addresses", async () => {
        const { resolveDirectTarget } = require("../../../cloudflare/runner/checker");

        await assert.rejects(
            resolveDirectTarget("metadata.public.example", null, async () => ({
                address: "169.254.169.254",
                family: 4,
            })),
            /Direct Worker checks cannot target private, loopback, link-local, or metadata hosts/
        );
    });

    test("Twingate HTTP checks in userspace mode use the configured HTTP proxy", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let proxyRequests = 0;
        const proxy = await listen(
            http.createServer((req, res) => {
                proxyRequests++;
                assert.strictEqual(req.url, "http://private.example.test/health");
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("proxied ok");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 2,
                type: "http",
                url: "http://private.example.test/health",
                timeout: 5,
                saveResponse: true,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "proxied ok");
        assert.strictEqual(proxyRequests, 1);
    });

    test("Twingate HTTP checks in TUN mode connect to the target directly", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let targetRequests = 0;
        let proxyRequests = 0;
        const target = await listen(
            http.createServer((req, res) => {
                targetRequests++;
                assert.strictEqual(req.url, "/health");
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("direct twingate ok");
            })
        );
        const proxy = await listen(
            http.createServer((req, res) => {
                proxyRequests++;
                res.writeHead(502);
                res.end("proxy should not be used in TUN mode");
            }).on("connect", (_req, socket) => {
                proxyRequests++;
                socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 12,
                type: "http",
                url: `http://127.0.0.1:${target.port}/health`,
                timeout: 5,
                saveResponse: true,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "on",
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "direct twingate ok");
        assert.strictEqual(targetRequests, 1);
        assert.strictEqual(proxyRequests, 0);
    });

    test("Twingate HTTPS checks in TUN mode honor ignoreTls for self-signed certificates", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const target = await listen(
            https.createServer({
                key: SELF_SIGNED_KEY,
                cert: SELF_SIGNED_CERT,
            }, (_req, res) => {
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("private self signed ok");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 16,
                type: "http",
                url: `https://127.0.0.1:${target.port}/health`,
                timeout: 5,
                ignoreTls: true,
                saveResponse: true,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateTunMode: "on",
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "private self signed ok");
    });

    test("HTTP checks do not return response bodies unless response saving is enabled", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const target = await listen(
            http.createServer((req, res) => {
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("sensitive response body");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 10,
                type: "http",
                url: `http://public.example.test:${target.port}/health`,
                timeout: 5,
            },
            lookup: async () => ({ address: "127.0.0.1", family: 4 }),
            allowPrivateResolvedForTest: true,
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.response, null);
    });

    test("HTTP checks cap saved response bodies to the configured maximum", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const target = await listen(
            http.createServer((req, res) => {
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("0123456789abcdef");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 11,
                type: "http",
                url: `http://public.example.test:${target.port}/health`,
                timeout: 5,
                saveResponse: true,
                responseMaxLength: 8,
            },
            lookup: async () => ({ address: "127.0.0.1", family: 4 }),
            allowPrivateResolvedForTest: true,
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.response, "01234567");
    });

    test("HTTPS checks honor ignoreTls for self-signed certificates", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const target = await listen(
            https.createServer({
                key: SELF_SIGNED_KEY,
                cert: SELF_SIGNED_CERT,
            }, (_req, res) => {
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("self signed ok");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 15,
                type: "http",
                url: `https://public.example.test:${target.port}/health`,
                timeout: 5,
                ignoreTls: true,
                saveResponse: true,
            },
            lookup: async () => ({ address: "127.0.0.1", family: 4 }),
            allowPrivateResolvedForTest: true,
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "self signed ok");
    });

    test("HTTP checks use assigned active user proxy with basic auth", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let proxyRequests = 0;
        const proxy = await listen(
            http.createServer((req, res) => {
                proxyRequests++;
                assert.strictEqual(req.url, "http://public.example.test/health");
                assert.strictEqual(req.headers["proxy-authorization"], "Basic dXNlcjpwYXNz");
                res.writeHead(200, { "content-type": "text/plain" });
                res.end("user proxied ok");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 5,
                type: "http",
                url: "http://public.example.test/health",
                timeout: 5,
                saveResponse: true,
                proxy: {
                    protocol: "http",
                    host: "127.0.0.1",
                    port: proxy.port,
                    auth: true,
                    username: "user",
                    password: "pass",
                    active: true,
                },
            },
            networkProfile: null,
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "user proxied ok");
        assert.strictEqual(proxyRequests, 1);
    });

    test("HTTP checks ignore assigned inactive user proxy", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let proxyRequests = 0;
        const proxy = await listen(
            http.createServer((req, res) => {
                proxyRequests++;
                res.writeHead(502);
                res.end("inactive proxy should not be used");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 6,
                type: "http",
                url: "http://127.0.0.1:8080/health",
                timeout: 5,
                proxy: {
                    protocol: "http",
                    host: "127.0.0.1",
                    port: proxy.port,
                    active: false,
                },
            },
            networkProfile: null,
        });

        assert.strictEqual(result.status, DOWN);
        assert.strictEqual(
            result.msg,
            "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts"
        );
        assert.strictEqual(proxyRequests, 0);
    });

    test("Twingate proxy URL is not configurable through process env", async () => {
        const {
            SYSTEM_TWINGATE_PROXY_URL,
            resolveTwingateProxyUrl,
        } = require("../../../cloudflare/runner/checker");
        const originalProxyUrl = process.env.TWINGATE_PROXY_URL;

        process.env.TWINGATE_PROXY_URL = "http://127.0.0.1:34567";
        try {
            assert.strictEqual(SYSTEM_TWINGATE_PROXY_URL, "http://127.0.0.1:9999");
            assert.strictEqual(resolveTwingateProxyUrl({}), SYSTEM_TWINGATE_PROXY_URL);
            assert.strictEqual(
                resolveTwingateProxyUrl({ twingateProxyUrl: "http://127.0.0.1:45678" }),
                "http://127.0.0.1:45678"
            );
        } finally {
            if (originalProxyUrl === undefined) {
                delete process.env.TWINGATE_PROXY_URL;
            } else {
                process.env.TWINGATE_PROXY_URL = originalProxyUrl;
            }
        }
    });

    test("Twingate TCP checks in TUN mode connect directly and record latency", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let targetConnections = 0;
        let proxyRequests = 0;
        const target = await listen(
            net.createServer((socket) => {
                targetConnections++;
                socket.end();
            })
        );
        const proxy = await listen(
            http.createServer().on("connect", (req, socket) => {
                proxyRequests++;
                socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 3,
                type: "port",
                hostname: "127.0.0.1",
                port: target.port,
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "on",
        });

        assert.strictEqual(result.status, UP);
        assert.match(result.msg, /^\d+ ms$/);
        assert.strictEqual(targetConnections, 1);
        assert.strictEqual(proxyRequests, 0);
    });

    test("Twingate TCP checks in userspace mode do not treat CONNECT acceptance as endpoint liveness", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let connectTarget = null;
        const proxy = await listen(
            http.createServer().on("connect", (req, socket) => {
                connectTarget = req.url;
                socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 13,
                type: "port",
                hostname: "missing.internal",
                port: 3389,
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.match(result.msg, /Twingate userspace TCP checks require TUN mode/);
        assert.strictEqual(connectTarget, "missing.internal:3389");
    });

    test("Twingate TCP checks report resource or ACL rejection", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const proxy = await listen(
            http.createServer().on("connect", (req, socket) => {
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.end("resource unavailable");
            })
        );

        const result = await runCheck({
            monitor: {
                id: 4,
                type: "port",
                hostname: "blocked.internal",
                port: 443,
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.match(result.msg, /proxy rejected CONNECT with 403/);
    });

    test("Twingate Ping checks in userspace mode use proxy TCP fallback ports", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const connectTargets = [];
        const proxy = await listen(
            http.createServer().on("connect", (req, socket) => {
                connectTargets.push(req.url);
                if (req.url === "camera.internal:80") {
                    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
                    socket.once("data", () => {
                        socket.write("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n");
                        socket.end();
                    });
                } else {
                    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                    socket.end();
                }
            })
        );

        const result = await runCheck({
            monitor: {
                id: 5,
                type: "ping",
                hostname: "camera.internal",
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
            twingatePingFallbackPorts: [8080, 80],
        });

        assert.strictEqual(result.status, UP);
        assert.match(result.msg, /^\d+ ms \(TCP 80 via Twingate\)$/);
        assert.deepStrictEqual(connectTargets.sort(), ["camera.internal:80", "camera.internal:8080"]);
    });

    test("Twingate Ping checks in userspace mode fail closed when fallback ports are not configured", async () => {
        const { DEFAULT_TWINGATE_PING_FALLBACK_PORTS, runCheck } = require("../../../cloudflare/runner/checker");
        assert.deepStrictEqual(DEFAULT_TWINGATE_PING_FALLBACK_PORTS, []);

        const connectTargets = [];
        const proxy = await listen(
            http.createServer().on("connect", (req, socket) => {
                connectTargets.push(req.url);
                socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 7,
                type: "ping",
                hostname: "printer.internal",
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.strictEqual(
            result.msg,
            "Twingate userspace mode cannot run ICMP ping. Enable TUN mode or configure verifiable TCP fallback ports."
        );
        assert.deepStrictEqual(connectTargets, []);
    });

    test("Twingate Ping checks fail closed in userspace mode when fallback ports are disabled", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");

        const result = await runCheck({
            monitor: {
                id: 7,
                type: "ping",
                hostname: "wgs-node-006-test.wgs",
                timeout: 5,
                twingatePingFallbackPorts: [],
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: "http://127.0.0.1:9",
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.strictEqual(
            result.msg,
            "Twingate userspace mode cannot run ICMP ping. Enable TUN mode or configure verifiable TCP fallback ports."
        );
    });

    test("Twingate Ping userspace fallback does not treat raw TCP CONNECT acceptance as endpoint liveness", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        const proxy = await listen(
            http.createServer().on("connect", (_req, socket) => {
                socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 14,
                type: "ping",
                hostname: "printer.internal",
                timeout: 5,
                twingatePingFallbackPorts: [9100],
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.match(
            result.msg,
            /Twingate userspace ping could not verify printer\.internal on TCP ports 9100: 9100: TCP fallback port 9100 cannot verify target liveness/
        );
    });

    test("Twingate Ping checks in TUN mode run real ICMP instead of proxy fallback", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");
        let proxyRequests = 0;
        const proxy = await listen(
            http.createServer().on("connect", (_req, socket) => {
                proxyRequests++;
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.end();
            })
        );

        const result = await runCheck({
            monitor: {
                id: 8,
                type: "ping",
                hostname: "camera.internal",
                timeout: 5,
                ping_count: 1,
                ping_per_request_timeout: 2,
                packetSize: 56,
                ping_numeric: true,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
            twingateTunMode: "on",
            execFile: async (command, args) => {
                assert.strictEqual(command, "ping");
                assert.deepStrictEqual(args, ["-c", "1", "-W", "2", "-w", "5", "-s", "56", "-n", "camera.internal"]);
                return {
                    stdout:
                        "PING camera.internal (10.0.0.42) 56(84) bytes of data.\n" +
                        "64 bytes from 10.0.0.42: icmp_seq=1 ttl=56 time=8.4 ms\n\n" +
                        "--- camera.internal ping statistics ---\n" +
                        "1 packets transmitted, 1 received, 0% packet loss, time 0ms\n" +
                        "rtt min/avg/max/mdev = 8.400/8.400/8.400/0.000 ms\n",
                };
            },
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.ping, 8.4);
        assert.strictEqual(result.msg, "8.4 ms");
        assert.strictEqual(proxyRequests, 0);
    });

    test("Twingate Ping userspace fallback requires target liveness after CONNECT", async () => {
        const { runTwingateUserspacePingCheck } = require("../../../cloudflare/runner/checker");

        await assert.rejects(
            runTwingateUserspacePingCheck(
                {
                    hostname: "wgs-node-006-test.wgs",
                    timeout: 5,
                    ping_per_request_timeout: 2,
                },
                "http://127.0.0.1:9",
                1000,
                [443],
                {
                    probeTwingatePingPort: async () => ({
                        verified: false,
                        reason: "CONNECT accepted but target did not complete TLS handshake",
                    }),
                    now: () => 1003,
                }
            ),
            /Twingate userspace ping could not verify wgs-node-006-test\.wgs on TCP ports 443: 443: CONNECT accepted but target did not complete TLS handshake/
        );
    });

    test("Twingate Ping checks allow private targets through the TUN route", async () => {
        const { runPingCheck } = require("../../../cloudflare/runner/checker");

        const result = await runPingCheck(
            {
                hostname: "camera.internal",
                timeout: 5,
                ping_count: 1,
                ping_per_request_timeout: 2,
                packetSize: 56,
                ping_numeric: true,
            },
            1000,
            async (command, args) => {
                assert.strictEqual(command, "ping");
                assert.deepStrictEqual(args, ["-c", "1", "-W", "2", "-w", "5", "-s", "56", "-n", "camera.internal"]);
                return {
                    stdout:
                        "PING camera.internal (10.0.0.42) 56(84) bytes of data.\n" +
                        "64 bytes from 10.0.0.42: icmp_seq=1 ttl=56 time=8.4 ms\n\n" +
                        "--- camera.internal ping statistics ---\n" +
                        "1 packets transmitted, 1 received, 0% packet loss, time 0ms\n" +
                        "rtt min/avg/max/mdev = 8.400/8.400/8.400/0.000 ms\n",
                };
            },
            () => 1015,
            { slug: "twingate", type: "twingate" }
        );

        assert.deepStrictEqual(result, {
            status: UP,
            ping: 8.4,
            msg: "8.4 ms",
            response: null,
        });
    });

    test("direct Ping checks return average ICMP latency", async () => {
        const { runPingCheck } = require("../../../cloudflare/runner/checker");

        const result = await runPingCheck(
            {
                hostname: "example.com",
                timeout: 5,
                ping_count: 3,
                ping_per_request_timeout: 2,
                packetSize: 56,
                ping_numeric: true,
            },
            1000,
            async (command, args) => {
                assert.strictEqual(command, "ping");
                assert.deepStrictEqual(args, ["-c", "3", "-W", "2", "-w", "5", "-s", "56", "-n", "example.com"]);
                return {
                    stdout:
                        "PING example.com (93.184.216.34) 56(84) bytes of data.\n" +
                        "64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=12.3 ms\n\n" +
                        "--- example.com ping statistics ---\n" +
                        "3 packets transmitted, 3 received, 0% packet loss, time 2002ms\n" +
                        "rtt min/avg/max/mdev = 10.100/12.345/14.900/1.200 ms\n",
                };
            },
            () => 1015,
            null,
            { lookup: async () => ({ address: "93.184.216.34", family: 4 }) }
        );

        assert.deepStrictEqual(result, {
            status: UP,
            ping: 12.345,
            msg: "12.345 ms",
            response: null,
        });
    });

    test("direct Ping checks reject output with no received ICMP packets", async () => {
        const { runPingCheck } = require("../../../cloudflare/runner/checker");

        await assert.rejects(
            runPingCheck(
                {
                    hostname: "wgs-node-006-test.wgs",
                    timeout: 5,
                    ping_count: 1,
                    ping_per_request_timeout: 2,
                    packetSize: 56,
                    ping_numeric: true,
                },
                1000,
                async () => ({
                    stdout:
                        "PING wgs-node-006-test.wgs (192.0.2.55) 56(84) bytes of data.\n\n" +
                        "--- wgs-node-006-test.wgs ping statistics ---\n" +
                        "1 packets transmitted, 0 received, 100% packet loss, time 0ms\n",
                }),
                () => 1002,
                null,
                { lookup: async () => ({ address: "192.0.2.55", family: 4 }) }
            ),
            /Ping failed: 0 packets received/
        );
    });

    test("direct Ping checks do not reject private DNS answers before ping runs", async () => {
        const { runPingCheck } = require("../../../cloudflare/runner/checker");

        const result = await runPingCheck(
            {
                hostname: "ring-ha.wgs",
                timeout: 5,
                ping_count: 1,
                ping_per_request_timeout: 2,
                packetSize: 56,
                ping_numeric: true,
            },
            1000,
            async (command, args) => {
                assert.strictEqual(command, "ping");
                assert.deepStrictEqual(args, ["-c", "1", "-W", "2", "-w", "5", "-s", "56", "-n", "ring-ha.wgs"]);
                return {
                    stdout:
                        "PING ring-ha.wgs (192.168.10.20) 56(84) bytes of data.\n" +
                        "64 bytes from 192.168.10.20: icmp_seq=1 ttl=63 time=1.8 ms\n\n" +
                        "--- ring-ha.wgs ping statistics ---\n" +
                        "1 packets transmitted, 1 received, 0% packet loss, time 0ms\n" +
                        "rtt min/avg/max/mdev = 1.800/1.800/1.800/0.000 ms\n",
                };
            },
            () => 1015,
            null,
            {
                lookup: async () => {
                    throw new Error("ping checks should not pre-resolve targets");
                },
            }
        );

        assert.deepStrictEqual(result, {
            status: UP,
            ping: 1.8,
            msg: "1.8 ms",
            response: null,
        });
    });
});

const SELF_SIGNED_KEY = `
-----BEGIN PRIVATE KEY-----
MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDNJM9df/FLu6K8
G+RBqX7qqjXYppi0xkZXVsxAF0Fc6K757HlEoEZEO7KY6iwJ3MoojLB9EG2G1C7p
Fosk7ozI4x4+F9wIIBz44NI5T/OECmk3ECid/PnvOMW/IDN/vhGhMDf2K1LJstGE
VreRlDbMmUHJB37r9lysD2WofKVZe58ENtBWwnh34qfoe1bOj4RKNcZ3kTluWe2d
0MyWUhR3DVpm/MKudq8BcdyW8d3Da4wegYbJoP7DrMlvd0nsUmGsxyzZatlm7BRs
4to/25hDG8b+wrAyDrQ/uPLE3QSqt35K0KXF+CS2+BmzfngEJuC3Pq6wsrZnZ2BA
LOOn0JbnAgMBAAECggEAEJI+pgDlzwZTOPrPz3YPqIkjXGLoxwGVQQzj5vF5+DVb
nRi7Gw4PXwerf6q67/kD446p2xBuqIuPVojZqJwUh03BbaajwYxGitwuXy7ULwBg
S3Bkt45t6iMd5jiFsHX8Gpc4jgwl3eEyB4yxu3LLkm923vRaDlmSVtvPjHK1MKsk
pURnXUFx3Zmjnv22ioqGmnwu4h5KHu61gqXhGa7elLid1AQwwGcTGkleSinIEUe4
ccuYq2CTpEnf1bMKymUTg2PYarPqyWBiYJIml2QS4zhGKNAE0Pk7Gu3puc1WWbGr
cRYYNOxUF7lIs9NhB5o7Qrq9Wf1wXUWRF3MmxIJscQKBgQD3bD+vSxRFr4AYCgED
O8BEDc5oNwY+CfUEVcvIftka6OTZ2MFDYBKFEap1i+O171ODaW+ew9erKOPt9I/d
yrTggmdqzMK54s+YKdQhMWJlFbJddZ/M52kMUC87DTHZzSHj0/cRt0Ye9fyXU20Y
EUSR7LCLkqpAip+iHLERnF88NQKBgQDUQVsyX69mw5LDSj+k5aQofgi3aDw+74ZB
g9FiHj5zVkv4KMeAPqKqHNMTsvIxvRYc8ZxH0YBCQEjNkvF09Z3+GLTgAQj1MJdS
ucu9uI9VcrLxwItbKwUC72Rayi+oQLbqHpK4wlzdnYTSTbA7uwT8cRhu570ah96M
q0Hg9HbSKwKBgQC4GIAuMsPrsdCykkb8m+nL+SXaXw6y/H+lcR0GmnN51U3qVaA/
PG2rO2DEw4hz55YRElNuIzQGc49cj3q4QUpiPkUqrx44Z22lP4JKDE+0/PbRGWME
eC6ubb8mxgOQllQgC6grM13mTYtbIUTsAnUtypn1z/QDv+FVItoRS3OE/QKBgHhD
U7XWC18Rnv1x+1+mEf4zcyLgN4p9UreaRa/vbPkSw1anXGpokugKDvrRYHMYLQhX
SXJT3PUs0VNRV+gqJsvLGej2DSpHzuW7ihpEEUqcA5IAw7TzShKgq17Zwmj1ye4b
RozS66VR0+kIxbsCO1ABkJN+UGJQ66MOgfRA73YjAn9gbFuIxHw3bBhmD9fjTKmw
RqfX1b/Ywxcb6kiPCP+uebcQPKWWK0wWIV9hVHw1tRQ0NexzxEUM0pdsMtcKYD7x
WJEf9pnWuXYiKzEWHMwWNw55A0fMK71+/tGVKa7nzYzuQCivdXVXsf7yIBp/Z+Np
fhEjbaw0/WwWmQrG8Fzw
-----END PRIVATE KEY-----
`;

const SELF_SIGNED_CERT = `
-----BEGIN CERTIFICATE-----
MIIC4TCCAcmgAwIBAgIJAK3cxKdt/KixMA0GCSqGSIb3DQEBCwUAMB4xHDAaBgNV
BAMME3B1YmxpYy5leGFtcGxlLnRlc3QwHhcNMjYwNjA1MDAxMTUyWhcNMzYwNjAy
MDAxMTUyWjAeMRwwGgYDVQQDDBNwdWJsaWMuZXhhbXBsZS50ZXN0MIIBIjANBgkq
hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzSTPXX/xS7uivBvkQal+6qo12KaYtMZG
V1bMQBdBXOiu+ex5RKBGRDuymOosCdzKKIywfRBthtQu6RaLJO6MyOMePhfcCCAc
+ODSOU/zhAppNxAonfz57zjFvyAzf74RoTA39itSybLRhFa3kZQ2zJlByQd+6/Zc
rA9lqHylWXufBDbQVsJ4d+Kn6HtWzo+ESjXGd5E5blntndDMllIUdw1aZvzCrnav
AXHclvHdw2uMHoGGyaD+w6zJb3dJ7FJhrMcs2WrZZuwUbOLaP9uYQxvG/sKwMg60
P7jyxN0Eqrd+StClxfgktvgZs354BCbgtz6usLK2Z2dgQCzjp9CW5wIDAQABoyIw
IDAeBgNVHREEFzAVghNwdWJsaWMuZXhhbXBsZS50ZXN0MA0GCSqGSIb3DQEBCwUA
A4IBAQAoEILfR9XCn+mG9LZuuO/zgOoy8k7uRPA2nzIs0NOVvEPjIk1hEMmk7xp0
M8Ku6tn1TFIlhqgts5pWHG7o6+wG5ZPFXv6ry2Qes75bRMLtUgk6h2OKrWF+7vRz
cL2DVDpp+K+V+/xi1Ek8KGm8Wu1nZ462UWxToZFie9nLDQ/U/Gb/n7zlCRlbiZ0b
3wmV8Z0jY5hZ9+oX5XpJjVMRnQFSFx9FE4XAt+RoGDE2yx8TyNwZSlUfUyy+91/w
Iji3NB8dTYmVcQ66taV5i0dYCWY5LyodOSkHDrQGgNp9XVgFeIN6A2Lv+PsOYH5z
u+l1uRgttneeiT6xmfpZxGaSsr4k
-----END CERTIFICATE-----
`;

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const serverInfo = {
                server,
                port: server.address().port,
            };
            servers.push(serverInfo);
            resolve(serverInfo);
        });
    });
}

function closeServer(serverInfo) {
    return new Promise((resolve) => {
        serverInfo.server.closeAllConnections?.();
        serverInfo.server.close(resolve);
    });
}
