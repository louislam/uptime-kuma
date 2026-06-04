const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");
const Heartbeat = require("../../server/model/heartbeat");
const { RESPONSE_BODY_LENGTH_DEFAULT } = require("../../src/util");

describe("Monitor response saving", () => {
    test("getSaveResponse and getSaveErrorResponse parse booleans", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.save_response = 1;
        monitor.save_error_response = 0;

        assert.strictEqual(monitor.getSaveResponse(), true);
        assert.strictEqual(monitor.getSaveErrorResponse(), false);
    });

    test("saveResponseData stores and truncates response", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;

        const bean = {};
        await monitor.saveResponseData(bean, "abcdef");

        assert.strictEqual(await Heartbeat.decodeResponseValue(bean.response), "abcde... (truncated)");
    });

    test("saveResponseData stringifies objects", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = RESPONSE_BODY_LENGTH_DEFAULT;

        const bean = {};
        await monitor.saveResponseData(bean, { ok: true });

        assert.strictEqual(await Heartbeat.decodeResponseValue(bean.response), JSON.stringify({ ok: true }));
    });
});

describe("Monitor OAuth2 authorization", () => {
    test("getOAuth2AuthorizationHeader() rejects tokens without a token type", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.oauthAccessToken = {
            access_token: "example-token",
        };

        assert.throws(
            () => monitor.getOAuth2AuthorizationHeader(),
            /OAuth access-token response is missing token_type/
        );
    });

    test("getOAuth2AuthorizationHeader() builds the authorization value", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.oauthAccessToken = {
            token_type: "Bearer",
            access_token: "example-token",
        };

        assert.strictEqual(monitor.getOAuth2AuthorizationHeader(), "Bearer example-token");
    });
});
