const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");

const Indigo = require("../../../server/notification-providers/indigo");

describe("Indigo notification provider", () => {
    let server;
    let baseUrl;
    let requests = [];
    let reply = {};
    let status = 200;

    before(async () => {
        const app = express();
        app.use(express.json());
        app.post("/v2/api/command", (req, res) => {
            requests.push({ auth: req.headers.authorization, body: req.body });
            res.status(status).json(reply);
        });
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => server.close());

    const notification = (extra) => ({ indigoUrl: `${baseUrl}/`, indigoApiKey: "key", ...extra });

    test("writes the variable, then executes the action group", async () => {
        requests = [];
        reply = { success: true };
        const result = await new Indigo().send(
            notification({ indigoVariableId: "111", indigoActionGroupId: "222" }),
            "[MQTT] [🔴 Down] timeout"
        );

        assert.strictEqual(result, "Sent Successfully.");
        assert.deepStrictEqual(
            requests.map((r) => r.body),
            [
                {
                    id: "uptime-kuma",
                    message: "indigo.variable.updateValue",
                    objectId: 111,
                    parameters: { value: "[MQTT] [🔴 Down] timeout" },
                },
                { id: "uptime-kuma", message: "indigo.actionGroup.execute", objectId: 222 },
            ]
        );
        assert.strictEqual(requests[0].auth, "Bearer key");
    });

    test("requires a variable or an action group", async () => {
        await assert.rejects(new Indigo().send(notification({}), "msg"), /variable ID, an action group ID/);
    });

    test("reports Indigo's HTTP 400 validation errors", async () => {
        status = 400;
        reply = {
            id: "uptime-kuma",
            validationErrors: { objectId: "id is not a valid Indigo Action Group" },
            error: "invalid command payload received, id: 'uptime-kuma'",
        };
        await assert.rejects(
            new Indigo().send(notification({ indigoActionGroupId: "1" }), "msg"),
            /not a valid Indigo Action Group/
        );
        status = 200;
    });

    test("reports errors Indigo returns in the response body", async () => {
        reply = { error: "object not found", id: "uptime-kuma" };
        await assert.rejects(
            new Indigo().send(notification({ indigoActionGroupId: "999" }), "msg"),
            /object not found/
        );
    });
});
