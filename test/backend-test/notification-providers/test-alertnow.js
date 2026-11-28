const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const AlertNow = require("../../../server/notification-providers/alertnow");
const { Settings } = require("../../../server/settings");
const { UP, DOWN } = require("../../../src/util");

describe("AlertNow notification provider", () => {
    let sent;

    beforeEach(() => {
        sent = [];
        mock.method(axios, "post", async (url, data) => {
            sent.push(data);
            return { status: 200, data: "" };
        });
        mock.method(Settings, "get", async () => "https://kuma.example.com");
    });

    afterEach(() => mock.restoreAll());

    const notification = { alertNowWebhookURL: "https://alertnow.example.com/webhook" };
    const monitor = { id: 7, name: "My Monitor", type: "http", url: "https://example.com" };
    // Same shape as Heartbeat.toJSON(): it does not contain the monitor name
    const heartbeat = (status) => ({ monitorID: 7, status, msg: "msg", time: "2026-01-01 00:00:00.000" });

    test("send() uses the monitor name when the monitor is down", async () => {
        const alertNow = new AlertNow();
        await alertNow.send(notification, "Monitor is down", monitor, heartbeat(DOWN));

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].status, "open");
        assert.strictEqual(sent[0].event_type, "ERROR");
        assert.strictEqual(
            sent[0].summary,
            "[My Monitor] 🔴 Application went down - Monitor is down >> https://kuma.example.com/dashboard/7"
        );
        assert.ok(!sent[0].summary.includes("undefined"));
    });

    test("send() uses the monitor name when the monitor is back up", async () => {
        const alertNow = new AlertNow();
        await alertNow.send(notification, "Monitor is up", monitor, heartbeat(UP));

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].status, "close");
        assert.strictEqual(sent[0].event_type, "INFO");
        assert.strictEqual(
            sent[0].summary,
            "[My Monitor] ✅ Application is back online - Monitor is up >> https://kuma.example.com/dashboard/7"
        );
        assert.match(sent[0].event_id, /^\d{8}_MyMonitor$/);
    });

    test("send() does not throw for a test message without monitor and heartbeat", async () => {
        const alertNow = new AlertNow();
        await alertNow.send(notification, "Test message");

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].summary, " - Test message");
        assert.strictEqual(sent[0].status, "open");
    });
});
