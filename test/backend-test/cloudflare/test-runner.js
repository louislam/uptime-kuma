/* eslint-disable jsdoc/require-jsdoc */
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

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

    test("Twingate HTTP checks use the configured HTTP proxy", async () => {
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
        });

        assert.strictEqual(result.status, UP);
        assert.strictEqual(result.msg, "200 - OK");
        assert.strictEqual(result.response, "proxied ok");
        assert.strictEqual(proxyRequests, 1);
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

    test("Twingate TCP checks use HTTP CONNECT and record latency", async () => {
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
                id: 3,
                type: "port",
                hostname: "db.internal",
                port: 5432,
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateProxyUrl: `http://127.0.0.1:${proxy.port}`,
        });

        assert.strictEqual(result.status, UP);
        assert.match(result.msg, /^\d+ ms$/);
        assert.strictEqual(connectTarget, "db.internal:5432");
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
        });

        assert.strictEqual(result.status, DOWN);
        assert.match(result.msg, /proxy rejected CONNECT with 403/);
    });

    test("Ping over Twingate requires TUN mode", async () => {
        const { runCheck } = require("../../../cloudflare/runner/checker");

        const result = await runCheck({
            monitor: {
                id: 5,
                type: "ping",
                hostname: "camera.internal",
                timeout: 5,
            },
            networkProfile: { slug: "twingate", type: "twingate" },
            twingateTunMode: "off",
        });

        assert.strictEqual(result.status, DOWN);
        assert.match(result.msg, /ICMP ping through Twingate requires Twingate TUN mode/);
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
