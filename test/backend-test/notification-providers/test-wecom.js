const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const WeCom = require("../../../server/notification-providers/wecom");
const { DOWN } = require("../../../src/util");

describe("WeCom notification provider", () => {
    let response;

    beforeEach(() => {
        response = { status: 200, data: { errcode: 0, errmsg: "ok" } };
        mock.method(axios, "post", async () => response);
    });

    afterEach(() => mock.restoreAll());

    const notification = { weComBotKey: "bot-key" };
    const heartbeat = { status: DOWN, msg: "msg" };

    test("send() reports success when WeCom accepts the message", async () => {
        const result = await new WeCom().send(notification, "Monitor is down", null, heartbeat);

        assert.strictEqual(result, "Sent Successfully.");
    });

    // WeCom replies with HTTP 200 and the failure in the body, so a rate-limited bot used to look like a success.
    test("send() throws when WeCom answers HTTP 200 with a non-zero errcode", async () => {
        response = { status: 200, data: { errcode: 45009, errmsg: "api freq out of limit" } };

        await assert.rejects(
            new WeCom().send(notification, "Monitor is down", null, heartbeat),
            /errcode 45009, api freq out of limit/
        );
    });
});
