process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "info_monitor", "warn_monitor", "debug"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");
const { R } = require("redbean-node");
const Monitor = require("../../server/model/monitor");
const { Notification } = require("../../server/notification");
const { Prometheus } = require("../../server/prometheus");
const { Settings } = require("../../server/settings");
const TestDB = require("../mock-testdb");

const testDb = new TestDB("./data/test-monitor-timeout");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll until fn() returns a truthy value.
 * @param {Function} fn polled function
 * @param {number} timeout ms before giving up
 * @param {string} label used in the timeout message
 * @returns {Promise<any>} the truthy value
 */
async function waitFor(fn, timeout, label) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const value = await fn();
        if (value) {
            return value;
        }
        await sleep(50);
    }
    throw new Error(`Timed out waiting for: ${label}`);
}

let io;
let userID;
let monitor;

const originalRequest = axios.request;

describe("Monitor timeout fallback", () => {
    before(async () => {
        await testDb.create();
        Notification.init();

        Prometheus.prototype.update = () => {};
        Prometheus.prototype.remove = () => {};
        Monitor.sendNotification = async () => {};

        const user = R.dispense("user");
        user.username = "monitor-timeout-test";
        user.password = "monitor-timeout-test";
        user.active = true;
        await R.store(user);
        userID = user.id;

        io = { to: () => ({ emit: () => {} }), sockets: { adapter: { rooms: new Map() } } };
    });

    after(async () => {
        axios.request = originalRequest;
        await monitor?.stop();
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    test("treats the fallback timeout as seconds, not milliseconds", async () => {
        const bean = R.dispense("monitor");
        bean.name = "timeout-fallback";
        bean.type = "http";
        bean.url = "https://example.com";
        bean.method = "get";
        bean.active = true;
        bean.user_id = userID;
        bean.interval = 60;
        bean.retryInterval = 60;
        bean.maxretries = 0;
        bean.timeout = 0; // not sent by the API/UI, so the runtime fallback decides
        bean.accepted_statuscodes_json = '["200-299"]';
        bean.resendInterval = 0;
        await R.store(bean);

        let requestOptions;
        axios.request = async (options) => {
            requestOptions = options;
            return { status: 200, statusText: "OK", headers: {}, data: "" };
        };

        monitor = await R.findOne("monitor", " id = ? ", [bean.id]);

        try {
            await monitor.start(io);

            await waitFor(() => requestOptions, 5000, "the monitor request");

            // interval 60s, so the request should time out after 0.8 * 60 = 48 seconds
            assert.strictEqual(
                requestOptions.timeout,
                48_000,
                `expected the fallback timeout to be 48s (48000 ms), got ${requestOptions.timeout} ms`
            );
        } finally {
            await monitor.stop();
            monitor = null;
        }
    });
});
