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
        // No database is set up in the backend-test environment.
        mock.method(Settings, "get", async () => null);
    });

    afterEach(() => mock.restoreAll());

    const notification = { alertNowWebhookURL: "https://example.com/alertnow" };
    const monitor = (id) => ({ id, name: `Monitor ${id}`, type: "http", url: "https://example.com" });
    // Real heartbeats carry no `name` field (Heartbeat#toJSON).
    const heartbeat = (monitorID, status) => ({ monitorID, status, msg: "msg", time: "2026-01-01 00:00:00.000" });

    test("send() uses the monitor name in down and up alerts", async () => {
        const alertNow = new AlertNow();
        await alertNow.send(notification, "7 is down", monitor(7), heartbeat(7, DOWN));
        await alertNow.send(notification, "7 is up", monitor(7), heartbeat(7, UP));

        assert.strictEqual(sent[0].summary, "[Monitor 7] 🔴 Application went down - 7 is down");
        assert.strictEqual(sent[0].status, "open");
        assert.strictEqual(sent[0].event_type, "ERROR");
        assert.strictEqual(sent[1].summary, "[Monitor 7] ✅ Application is back online - 7 is up");
        assert.strictEqual(sent[1].status, "close");
        assert.strictEqual(sent[1].event_type, "INFO");
        assert.ok(sent[1].event_id.endsWith("_Monitor7"), `event_id was ${sent[1].event_id}`);
    });
});
