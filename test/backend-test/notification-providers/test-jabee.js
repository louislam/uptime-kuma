const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");

const Jabee = require("../../../server/notification-providers/jabee");
const { DOWN, UP } = require("../../../src/util");

describe("Jabee notification provider", () => {
    let server;
    let baseUrl;
    let requests = [];
    let status = 201;

    before(async () => {
        const app = express();
        app.use(express.json());
        app.post("/api/v1/alerts", (req, res) => {
            requests.push({ auth: req.headers.authorization, body: req.body });
            res.status(status).json({ id: "apr_1", status: "pending" });
        });
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => server.close());

    const notification = () => ({ jabeeApiKey: "jak_key", jabeeBaseURL: baseUrl });
    const monitor = { id: 7, name: "api.example.com", url: "https://api.example.com" };

    test("sends a down heartbeat with the monitor named in the title", async () => {
        requests = [];
        const result = await new Jabee().send(notification(), "[api.example.com] [🔴 Down] timeout", monitor, {
            status: DOWN,
            time: "2026-11-14 10:00:00",
        });

        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(requests[0].auth, "Bearer jak_key");
        assert.deepStrictEqual(requests[0].body, {
            title: "🔴 api.example.com is down",
            body: "[api.example.com] [🔴 Down] timeout",
            url: "https://api.example.com",
            external_id: "uptime-kuma-7-2026-11-14 10:00:00",
        });
    });

    test("sends an up heartbeat", async () => {
        requests = [];
        await new Jabee().send(notification(), "[api.example.com] [✅ Up] 200 - OK", monitor, {
            status: UP,
            time: "2026-11-14 10:05:00",
        });

        assert.strictEqual(requests[0].body.title, "✅ api.example.com is up");
    });

    /** An expiry notice carries a monitor but no heartbeat. */
    test("marks a certificate or domain expiry with the monitor's name", async () => {
        requests = [];
        await new Jabee().send(notification(), "The certificate expires in 7 days", monitor, null);

        assert.strictEqual(requests[0].body.title, "⚠️ api.example.com");
        assert.strictEqual(requests[0].body.body, "The certificate expires in 7 days");
    });

    /** The test button sends neither a monitor nor a heartbeat. */
    test("falls back to the message itself on a test notification", async () => {
        requests = [];
        await new Jabee().send(notification(), "Testing", null, null);

        assert.strictEqual(requests[0].body.title, "Testing");
        assert.strictEqual(requests[0].body.external_id, undefined);
        assert.strictEqual(requests[0].body.url, undefined);
    });

    /** Jabee refuses a title longer than 120 characters. */
    test("clamps a long monitor name into the title limit", async () => {
        requests = [];
        await new Jabee().send(
            notification(),
            "down",
            { id: 1, name: "n".repeat(200) },
            {
                status: DOWN,
                time: "2026-11-14 10:10:00",
            }
        );

        assert.strictEqual(requests[0].body.title.length, 120);
        assert.ok(requests[0].body.title.endsWith("…"));
    });

    /** The placeholder Uptime Kuma leaves on a monitor with no URL. */
    test("omits the link when the monitor has none", async () => {
        requests = [];
        await new Jabee().send(
            notification(),
            "down",
            { id: 2, name: "db", url: "https://" },
            {
                status: DOWN,
                time: "2026-11-14 10:15:00",
            }
        );

        assert.strictEqual(requests[0].body.url, undefined);
    });

    test("reports a refusal rather than reporting success", async () => {
        status = 402;
        await assert.rejects(
            new Jabee().send(notification(), "down", monitor, { status: DOWN, time: "2026-11-14 10:20:00" })
        );
        status = 201;
    });
});
