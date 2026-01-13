process.env.NODE_ENV = "development";
process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after, mock } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));

const TestDB = require("../mock-testdb");
const { R } = require("redbean-node");
const Monitor = require("../../server/model/monitor");
const { Settings } = require("../../server/settings");
const { Prometheus } = require("../../server/prometheus");

const testDb = new TestDB();
let userCounter = 0;

const isoNow = () => R.isoDateTimeMillis(dayjs.utc());

const createEntity = async (type, data) => {
    const entity = R.dispense(type);
    Object.assign(entity, data);
    await R.store(entity);
    return entity;
};

const createUser = () => createEntity("user", {
    username: `test-${++userCounter}-${Date.now()}`,
    password: "Tellorian2003105$",
    active: 1
});

const createPushMonitor = (user, pushToken, maxretries) => createEntity("monitor", {
    name: "Push Monitor",
    active: 1,
    user_id: user.id,
    type: "push",
    push_token: pushToken,
    maxretries,
    interval: 60
});

const createHeartbeat = ({ monitorId, status, retries, time }) => createEntity("heartbeat", {
    important: 0,
    monitor_id: monitorId,
    status,
    msg: "No heartbeat in the time window",
    time,
    ping: null,
    duration: 0,
    down_count: 0,
    retries
});

const startApiApp = () => new Promise((resolve) => {
    const router = require("../../server/routers/api-router");
    const app = express().use(router);
    const server = app.listen(0, () => {
        const { port } = server.address();
        resolve({ server, url: `http://127.0.0.1:${port}` });
    });
});

describe("Push API determineStatus retries", () => {
    let api;

    before(async () => {
        await testDb.create();

        // Avoid side effects from notifications in /api/push
        mock.method(Monitor, "sendNotification", async () => {});

        // Prometheus metrics are not initialized in backend-test environment
        mock.method(Prometheus.prototype, "update", async () => {});

        api = await startApiApp();
    });

    after(async () => {
        if (api?.server) {
            api.server.close();
        }

        Settings.stopCacheCleaner();
        mock.restoreAll();
        await testDb.destroy();
    });

    test("PENDING + retries >= maxretries + status=down => DOWN and retries reset to 0", async () => {
        const monitor = await createPushMonitor(await createUser(), "token-1", 3);
        await createHeartbeat({ monitorId: monitor.id, status: 2, retries: 3, time: isoNow() });
        
        const res = await fetch(`${api.url}/api/push/token-1?status=down&msg=test`);
        assert.strictEqual(res.ok, true);
        
        const latest = await R.findOne("heartbeat", " monitor_id = ? ORDER BY id DESC", [monitor.id]);
        assert.ok(latest);
        assert.strictEqual(latest.status, 0);
        assert.strictEqual(latest.retries, 0);
    });

    test("PENDING + retries < maxretries + status=down => stays PENDING and retries increments", async () => {
        const monitor = await createPushMonitor(await createUser(), "token-2", 3);
        await createHeartbeat({ monitorId: monitor.id, status: 2, retries: 1, time: isoNow() });
        
        const res = await fetch(`${api.url}/api/push/token-2?status=down&msg=test`);
        assert.strictEqual(res.ok, true);
        
        const latest = await R.findOne("heartbeat", " monitor_id = ? ORDER BY id DESC", [monitor.id]);
        assert.ok(latest);
        assert.strictEqual(latest.status, 2);
        assert.strictEqual(latest.retries, 2);
    });
});
