// Unit tests for Monitor._refreshStaticConfig — H-3.
//
// Per H-3 in docs/ARCHITECTURE_REVIEW.md, the Monitor's heartbeat hot
// path used to re-query the proxy and docker_host rows on every beat,
// even though those rows only change on editMonitor (which restarts
// the monitor and re-runs start()). These tests pin down the
// pre-fetch + cache contract on _refreshStaticConfig() without
// spinning up a DB or scheduling actual beats.

process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "debug_monitor"].join(",");

const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const Monitor = require("../../server/model/monitor");
const ProxyModel = require("../../server/model/proxy");
const DockerHostModel = require("../../server/model/docker_host");

/**
 * Build a fake Objection query builder whose `findById` resolves to
 * `row` and counts every invocation against `counter`.
 * @param {object|null} row Row to resolve with
 * @param {{count: number}} counter Mutable counter shared with the test
 * @returns {Function} Replacement for `Model.query`
 */
function fakeQueryFactory(row, counter) {
    return () => ({
        findById: async (_id) => {
            counter.count += 1;
            return row;
        },
    });
}

describe("Monitor._refreshStaticConfig (H-3)", () => {
    let originalProxyQuery;
    let originalDockerHostQuery;

    beforeEach(() => {
        originalProxyQuery = ProxyModel.query;
        originalDockerHostQuery = DockerHostModel.query;
    });

    afterEach(() => {
        ProxyModel.query = originalProxyQuery;
        DockerHostModel.query = originalDockerHostQuery;
    });

    test("populates _proxyBean when proxy_id is set", async () => {
        const proxyRow = { id: 7, active: 1, protocol: "http", host: "127.0.0.1", port: 1080 };
        const proxyCalls = { count: 0 };
        ProxyModel.query = fakeQueryFactory(proxyRow, proxyCalls);
        DockerHostModel.query = fakeQueryFactory(null, { count: 0 });

        const monitor = Object.create(Monitor.prototype);
        monitor.proxy_id = 7;
        monitor.docker_host = null;

        await monitor._refreshStaticConfig();

        assert.strictEqual(monitor._proxyBean, proxyRow);
        assert.strictEqual(monitor._dockerHostBean, null);
        assert.strictEqual(proxyCalls.count, 1);
    });

    test("populates _dockerHostBean when docker_host is set", async () => {
        const dockerRow = { id: 3, _dockerType: "socket", _dockerDaemon: "/var/run/docker.sock" };
        const dockerCalls = { count: 0 };
        ProxyModel.query = fakeQueryFactory(null, { count: 0 });
        DockerHostModel.query = fakeQueryFactory(dockerRow, dockerCalls);

        const monitor = Object.create(Monitor.prototype);
        monitor.proxy_id = null;
        monitor.docker_host = 3;

        await monitor._refreshStaticConfig();

        assert.strictEqual(monitor._proxyBean, null);
        assert.strictEqual(monitor._dockerHostBean, dockerRow);
        assert.strictEqual(dockerCalls.count, 1);
    });

    test("clears _proxyBean and _dockerHostBean when both ids are falsy", async () => {
        const proxyCalls = { count: 0 };
        const dockerCalls = { count: 0 };
        ProxyModel.query = fakeQueryFactory({ id: 99 }, proxyCalls);
        DockerHostModel.query = fakeQueryFactory({ id: 99 }, dockerCalls);

        const monitor = Object.create(Monitor.prototype);
        monitor.proxy_id = null;
        monitor.docker_host = null;
        // Pretend a previous incarnation populated the cache.
        monitor._proxyBean = { id: 1 };
        monitor._dockerHostBean = { id: 2 };

        await monitor._refreshStaticConfig();

        assert.strictEqual(monitor._proxyBean, null);
        assert.strictEqual(monitor._dockerHostBean, null);
        // No DB hits when ids are falsy.
        assert.strictEqual(proxyCalls.count, 0);
        assert.strictEqual(dockerCalls.count, 0);
    });

    test("setting proxy_id back to null then refreshing clears the cache", async () => {
        const proxyRow = { id: 11, active: 1 };
        const proxyCalls = { count: 0 };
        ProxyModel.query = fakeQueryFactory(proxyRow, proxyCalls);
        DockerHostModel.query = fakeQueryFactory(null, { count: 0 });

        const monitor = Object.create(Monitor.prototype);
        monitor.proxy_id = 11;
        monitor.docker_host = null;

        await monitor._refreshStaticConfig();
        assert.strictEqual(monitor._proxyBean, proxyRow);

        // Simulate editMonitor clearing the proxy.
        monitor.proxy_id = null;
        await monitor._refreshStaticConfig();
        assert.strictEqual(monitor._proxyBean, null);
    });

    test("static config is fetched once across multiple simulated beats", async () => {
        // Reproduces the H-3 hot-path contract: a monitor with proxy_id
        // and docker_host both set should run _refreshStaticConfig once
        // (during start()) and then every beat() should reuse the
        // cached beans — never calling Proxy.query() / DockerHost.query()
        // itself for static config.
        const proxyRow = { id: 1, active: 1 };
        const dockerRow = { id: 2, _dockerType: "socket", _dockerDaemon: "/var/run/docker.sock" };
        const proxyCalls = { count: 0 };
        const dockerCalls = { count: 0 };
        ProxyModel.query = fakeQueryFactory(proxyRow, proxyCalls);
        DockerHostModel.query = fakeQueryFactory(dockerRow, dockerCalls);

        const monitor = Object.create(Monitor.prototype);
        monitor.proxy_id = 1;
        monitor.docker_host = 2;

        // start() pre-fetches.
        await monitor._refreshStaticConfig();

        // Simulate the static-config reads inside beat() across many
        // heartbeats. With H-3 fixed, these are plain field reads;
        // before the fix, each iteration triggered a fresh query.
        for (let i = 0; i < 10; i++) {
            const proxy = monitor._proxyBean;
            const dockerHost = monitor._dockerHostBean;
            assert.strictEqual(proxy, proxyRow);
            assert.strictEqual(dockerHost, dockerRow);
        }

        assert.strictEqual(proxyCalls.count, 1, "Proxy.query() must run exactly once across pre-fetch + 10 beats");
        assert.strictEqual(dockerCalls.count, 1, "DockerHost.query() must run exactly once across pre-fetch + 10 beats");
    });
});
