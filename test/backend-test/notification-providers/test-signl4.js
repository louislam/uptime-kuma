const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const SIGNL4 = require("../../../server/notification-providers/signl4");
const { UP, DOWN } = require("../../../src/util");

describe("SIGNL4 notification provider", () => {
    let sent;

    beforeEach(() => {
        sent = [];
        mock.method(axios, "post", async (url, data) => {
            sent.push(data);
            return { status: 200, data: "" };
        });
    });

    afterEach(() => mock.restoreAll());

    const notification = { webhookURL: "https://connect.signl4.com/webhook/team-secret" };
    const monitor = (id) => ({ id, name: `Monitor ${id}`, type: "http", url: "https://example.com" });
    const heartbeat = (monitorID, status) => ({ monitorID, status, msg: "msg", time: "2026-01-01 00:00:00.000" });

    // SIGNL4 resolves the alerts whose external ID matches, so the ID has to differ between monitors.
    test("send() uses the monitor ID as the external ID of the alert", async () => {
        const signl4 = new SIGNL4();
        await signl4.send(notification, "7 is down", monitor(7), heartbeat(7, DOWN));
        await signl4.send(notification, "8 is down", monitor(8), heartbeat(8, DOWN));
        await signl4.send(notification, "7 is up", monitor(7), heartbeat(7, UP));

        assert.deepStrictEqual(
            sent.map((data) => [data["X-S4-ExternalID"], data["X-S4-Status"]]),
            [
                ["UptimeKuma-7", "new"],
                ["UptimeKuma-8", "new"],
                ["UptimeKuma-7", "resolved"],
            ]
        );
    });
});
