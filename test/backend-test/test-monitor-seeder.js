const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const TestDB = require("../mock-testdb");
const { R } = require("redbean-node");
const { seedMonitorsFromEnv } = require("../../server/monitor-seeder");

// Stub io and server — we don't need real socket or monitor list for DB tests
const mockIo = {};
const noopStart = async () => {};

function makeServer() {
    return { monitorList: {} };
}

async function createUser() {
    const user = R.dispense("user");
    user.username = "testuser";
    user.password = "hashed";
    await R.store(user);
    return user;
}

describe("seedMonitorsFromEnv()", () => {
    let db;
    let originalEnv;

    beforeEach(async () => {
        originalEnv = process.env.UPTIME_KUMA_MONITORS;
        db = new TestDB(path.join(__dirname, "../../data/test-seeder-" + Date.now()));
        await db.create();
    });

    afterEach(async () => {
        if (originalEnv === undefined) {
            delete process.env.UPTIME_KUMA_MONITORS;
        } else {
            process.env.UPTIME_KUMA_MONITORS = originalEnv;
        }
        await db.destroy();
    });

    test("seedMonitorsFromEnv() does nothing when env var is not set", async () => {
        delete process.env.UPTIME_KUMA_MONITORS;
        await createUser();
        const server = makeServer();

        await seedMonitorsFromEnv(mockIo, server, noopStart);

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 0);
        assert.deepStrictEqual(server.monitorList, {});
    });

    test("seedMonitorsFromEnv() creates monitors from valid JSON", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Service A", url: "https://a.example.com" },
            { name: "Service B", url: "https://b.example.com", interval: 30 },
        ]);
        await createUser();
        const server = makeServer();

        await seedMonitorsFromEnv(mockIo, server, noopStart);

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 2);
        assert.ok(monitors.some((m) => m.name === "Service A" && m.url === "https://a.example.com"));
        assert.ok(monitors.some((m) => m.name === "Service B" && m.url === "https://b.example.com" && m.interval === 30));
    });

    test("seedMonitorsFromEnv() adds created monitors to server.monitorList", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Service A", url: "https://a.example.com" },
        ]);
        await createUser();
        const server = makeServer();

        await seedMonitorsFromEnv(mockIo, server, noopStart);

        assert.strictEqual(Object.keys(server.monitorList).length, 1);
    });

    test("seedMonitorsFromEnv() applies default field values", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Minimal", url: "https://minimal.example.com" },
        ]);
        await createUser();

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitor = await R.findOne("monitor", " url = ? ", [ "https://minimal.example.com" ]);
        assert.ok(monitor, "monitor should exist");
        assert.strictEqual(monitor.type, "http");
        assert.strictEqual(monitor.interval, 60);
        assert.strictEqual(monitor.maxretries, 1);
        assert.strictEqual(monitor.timeout, 48);
        assert.strictEqual(monitor.active, 1);
        assert.strictEqual(monitor.method, "GET");
        assert.strictEqual(monitor.maxredirects, 10);
        assert.strictEqual(monitor.accepted_statuscodes_json, '["200-299"]');
    });

    test("seedMonitorsFromEnv() is idempotent — skips duplicate URLs", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Service A", url: "https://a.example.com" },
        ]);
        await createUser();

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);
        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitors = await R.find("monitor", " url = ? ", [ "https://a.example.com" ]);
        assert.strictEqual(monitors.length, 1, "monitor should not be duplicated");
    });

    test("seedMonitorsFromEnv() skips entries missing required fields", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "No URL" },
            { url: "https://no-name.example.com" },
            { name: "Valid", url: "https://valid.example.com" },
        ]);
        await createUser();

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 1);
        assert.strictEqual(monitors[0].name, "Valid");
    });

    test("seedMonitorsFromEnv() does nothing when no user exists", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Service A", url: "https://a.example.com" },
        ]);

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 0);
    });

    test("seedMonitorsFromEnv() does nothing when env var is invalid JSON", async () => {
        process.env.UPTIME_KUMA_MONITORS = "not-valid-json{{";
        await createUser();

        await assert.doesNotReject(
            () => seedMonitorsFromEnv(mockIo, makeServer(), noopStart),
            "seeder should not throw on invalid JSON"
        );

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 0);
    });

    test("seedMonitorsFromEnv() does nothing when env var is an empty array", async () => {
        process.env.UPTIME_KUMA_MONITORS = "[]";
        await createUser();

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitors = await R.findAll("monitor");
        assert.strictEqual(monitors.length, 0);
    });

    test("seedMonitorsFromEnv() assigns monitors to the correct user", async () => {
        process.env.UPTIME_KUMA_MONITORS = JSON.stringify([
            { name: "Service A", url: "https://a.example.com" },
        ]);
        const user = await createUser();

        await seedMonitorsFromEnv(mockIo, makeServer(), noopStart);

        const monitor = await R.findOne("monitor", " url = ? ", [ "https://a.example.com" ]);
        assert.strictEqual(monitor.user_id, user.id);
    });
});
