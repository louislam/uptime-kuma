const { after, before, describe, test } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { ElasticsearchMonitorType } = require("../../../server/monitor-types/elasticsearch");
const { PENDING, UP } = require("../../../src/util");

const skipContainerTests = !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64");

if (skipContainerTests) {
    test("Elasticsearch container tests require Linux x64 in CI", { skip: true }, () => {});
} else {
    describe("Elasticsearch Single Node", () => {
        let container;

        before(async () => {
            const { ElasticsearchContainer } = require("@testcontainers/elasticsearch");
            container = await new ElasticsearchContainer("elasticsearch:8.17.0")
                .withPassword("testPassword123!")
                .withEnvironment({ ES_JAVA_OPTS: "-Xms512m -Xmx512m" })
                .withStartupTimeout(120000)
                .start();
        });

        after(async () => {
            if (container) {
                await container.stop();
            }
        });

        /**
         * Check the monitor against the Elasticsearch test container.
         * @param {object} overrides Monitor property overrides
         * @returns {Promise<object>} Resulting heartbeat
         */
        async function checkContainer(overrides = {}) {
            const monitor = {
                name: "Elasticsearch container test",
                elasticsearchNodes: JSON.stringify([container.getHttpUrl()]),
                elasticsearchStatus: "yellow",
                elasticsearchMinimumNodes: 1,
                basic_auth_user: container.getUsername(),
                basic_auth_pass: container.getPassword(),
                timeout: 10,
                ignoreTls: false,
                ...overrides,
            };
            const heartbeat = { msg: "", status: PENDING };
            await new ElasticsearchMonitorType().check(monitor, heartbeat, {});
            return heartbeat;
        }

        test("connects to a password-protected Elasticsearch container", async () => {
            const heartbeat = await checkContainer();
            assert.strictEqual(heartbeat.status, UP);
            assert.match(heartbeat.msg, /^Elasticsearch cluster .* is (green|yellow)$/);
        });

        test("rejects invalid credentials from a real Elasticsearch node", async () => {
            await assert.rejects(checkContainer({ basic_auth_pass: "wrong-password" }), /401/);
        });
    });
}

describe("Elasticsearch monitor", () => {
    let server;
    let proxyServer;
    let baseUrl;
    let proxyPort;
    let proxyRequest;
    let response;
    let lastRequest;

    before(async () => {
        server = http.createServer((request, res) => {
            lastRequest = request;
            const currentResponse = response;
            setTimeout(() => {
                res.writeHead(currentResponse.statusCode || 200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(currentResponse.body));
            }, currentResponse.delay || 0);
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        proxyServer = http.createServer((request, res) => {
            proxyRequest = request;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ cluster_name: "proxy-cluster", status: "green", timed_out: false }));
        });
        await new Promise((resolve) => proxyServer.listen(0, "127.0.0.1", resolve));
        proxyPort = proxyServer.address().port;
    });

    after(async () => {
        server.closeAllConnections();
        proxyServer.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await new Promise((resolve) => proxyServer.close(resolve));
    });

    /**
     * Run an Elasticsearch monitor check against the test server.
     * @param {object} overrides Monitor property overrides
     * @returns {Promise<object>} Resulting heartbeat
     */
    async function check(overrides = {}) {
        const monitor = {
            name: "Elasticsearch test",
            elasticsearchNodes: JSON.stringify([baseUrl]),
            timeout: 1,
            ignoreTls: false,
            elasticsearchStatus: "yellow",
            ...overrides,
        };
        const heartbeat = { msg: "", status: PENDING };
        await new ElasticsearchMonitorType().check(monitor, heartbeat, {});
        return heartbeat;
    }

    test("accepts a healthy cluster and preserves a base path", async () => {
        response = { body: { cluster_name: "test-cluster", status: "green", timed_out: false } };
        const heartbeat = await check({ elasticsearchNodes: JSON.stringify([`${baseUrl}/elastic`]) });
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Elasticsearch cluster (test-cluster) is green");
        assert.strictEqual(new URL(lastRequest.url, baseUrl).pathname, "/elastic/_cluster/health");
        assert.match(lastRequest.url, /filter_path=/);
    });

    test("sends basic authentication when only the username is set", async () => {
        response = { body: { status: "yellow", timed_out: false } };
        await check({ basic_auth_user: "elastic" });
        assert.strictEqual(
            lastRequest.headers.authorization,
            `Basic ${Buffer.from("elastic:").toString("base64")}`
        );
    });

    test("sends basic authentication when only the password is set", async () => {
        response = { body: { status: "yellow", timed_out: false } };
        await check({ basic_auth_pass: "secret" });
        assert.strictEqual(
            lastRequest.headers.authorization,
            `Basic ${Buffer.from(":secret").toString("base64")}`
        );
    });

    test("routes the cluster health request through the configured proxy", async () => {
        const { R } = require("redbean-node");
        const originalLoad = R.load;
        R.load = async () => ({
            active: true,
            protocol: "http",
            host: "127.0.0.1",
            port: proxyPort,
            auth: true,
            username: "proxy-user",
            password: "proxy-password",
        });

        try {
            const heartbeat = await check({
                elasticsearchNodes: JSON.stringify(["http://unreachable.invalid:9200"]),
                proxy_id: 1,
            });
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Elasticsearch cluster (proxy-cluster) is green");
            assert.strictEqual(
                proxyRequest.headers["proxy-authorization"],
                `Basic ${Buffer.from("proxy-user:proxy-password").toString("base64")}`
            );
            assert.strictEqual(new URL(proxyRequest.url).pathname, "/_cluster/health");
        } finally {
            R.load = originalLoad;
        }
    });

    test("accepts yellow when the minimum is yellow", async () => {
        response = { body: { status: "yellow", timed_out: false } };
        const heartbeat = await check();
        assert.strictEqual(heartbeat.status, UP);
    });

    test("is up when number_of_nodes equals the configured minimum", async () => {
        response = { body: { status: "green", timed_out: false, number_of_nodes: 3 } };
        const heartbeat = await check({ elasticsearchMinimumNodes: 3 });
        assert.strictEqual(heartbeat.status, UP);
    });

    test("is down when number_of_nodes is below the configured minimum", async () => {
        response = { body: { status: "yellow", timed_out: false, number_of_nodes: 2 } };
        await assert.rejects(check({ elasticsearchMinimumNodes: 3 }), /cluster has 2 nodes, expected at least 3/);
    });

    test("preserves the original behavior when minimum nodes is not configured", async () => {
        response = { body: { status: "green", timed_out: false } };
        const heartbeat = await check({ elasticsearchMinimumNodes: "" });
        assert.strictEqual(heartbeat.status, UP);
    });

    test("is down when the cluster is green but has too few nodes", async () => {
        response = { body: { status: "green", timed_out: false, number_of_nodes: 2 } };
        await assert.rejects(check({ elasticsearchMinimumNodes: 3 }), /cluster has 2 nodes, expected at least 3/);
    });

    test("rejects yellow when the minimum is green", async () => {
        response = { body: { status: "yellow", timed_out: false } };
        await assert.rejects(check({ elasticsearchStatus: "green" }), /status is yellow, expected at least green/);
    });

    test("rejects red, timed out, and malformed health responses", async () => {
        response = { body: { status: "red", timed_out: false } };
        await assert.rejects(check(), /status is red/);
        response = { body: { status: "green", timed_out: true } };
        await assert.rejects(check(), /health request timed out/);
        response = { body: { cluster_name: "missing-status" } };
        await assert.rejects(check(), /invalid cluster health response/);
    });

    test("rejects prototype property names as minimum or health status", async () => {
        response = { body: { status: "red", timed_out: false } };
        await assert.rejects(
            check({ elasticsearchStatus: "toString" }),
            /Invalid minimum Elasticsearch status: toString/
        );
        response = { body: { status: "__proto__", timed_out: false } };
        await assert.rejects(check(), /invalid cluster health response/);
        response = { body: { status: "constructor", timed_out: false } };
        await assert.rejects(check(), /invalid cluster health response/);
    });

    test("surfaces HTTP errors and enforces the request timeout", async () => {
        response = { statusCode: 401, body: { error: "unauthorized" } };
        await assert.rejects(check(), /401/);
        response = { delay: 100, body: { status: "green", timed_out: false } };
        await assert.rejects(check({ timeout: 0.01 }), /timeout|aborted/i);
    });

    test("tries the next node after a connection failure", async () => {
        response = {
            body: { cluster_name: "fallback-cluster", status: "green", timed_out: false, number_of_nodes: 3 },
        };
        const heartbeat = await check({
            elasticsearchNodes: JSON.stringify(["http://127.0.0.1:1", baseUrl]),
            elasticsearchMinimumNodes: 3,
        });
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Elasticsearch cluster (fallback-cluster) is green");
    });

    test("fails immediately when a reachable node reports unacceptable cluster health", async () => {
        response = { body: { status: "red", timed_out: false } };
        await assert.rejects(
            check({ elasticsearchNodes: JSON.stringify([baseUrl, "http://127.0.0.1:1"]) }),
            (error) => {
                assert.strictEqual(error.message, "Elasticsearch cluster status is red, expected at least yellow");
                return true;
            }
        );
    });

    test("reports consolidated errors when all nodes fail", async () => {
        const monitorType = new ElasticsearchMonitorType();
        monitorType.checkSingleNode = async (monitor, url) => {
            throw new Error(`Connection failed: ${url}`);
        };
        const heartbeat = { msg: "", status: PENDING };

        await assert.rejects(
            monitorType.check(
                {
                    elasticsearchNodes: JSON.stringify(["http://node1:9200", "http://node2:9200"]),
                    elasticsearchStatus: "yellow",
                },
                heartbeat,
                {}
            ),
            (error) => {
                assert.match(error.message, /All 2 Elasticsearch nodes failed/);
                assert.match(error.message, /Node 1:/);
                assert.match(error.message, /Node 2:/);
                return true;
            }
        );
    });

    test("rejects credentials embedded in a node URL", async () => {
        await assert.rejects(
            check({ elasticsearchNodes: JSON.stringify(["http://elastic:secret@127.0.0.1:9200"]) }),
            /must not include credentials/
        );
    });
});
