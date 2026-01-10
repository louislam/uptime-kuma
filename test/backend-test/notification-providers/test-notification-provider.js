const { describe, test } = require("node:test");
const assert = require("node:assert");

const NotificationProvider = require("../../../server/notification-providers/notification-provider");

describe("NotificationProvider.throwGeneralAxiosError()", () => {
    const provider = new NotificationProvider();

    test("expands AggregateError causes", () => {
        let err1 = new Error("connect ECONNREFUSED 127.0.0.1:443");
        err1.code = "ECONNREFUSED";
        let err2 = new Error("connect ECONNREFUSED ::1:443");
        err2.code = "ECONNREFUSED";

        let aggErr = new AggregateError([err1, err2], "AggregateError");

        assert.throws(
            () => provider.throwGeneralAxiosError(aggErr),
            (thrown) => {
                assert.ok(!thrown.message.startsWith("AggregateError"));
                assert.ok(thrown.message.includes("caused by:"));
                assert.ok(thrown.message.includes("127.0.0.1:443"));
                assert.ok(thrown.message.includes("::1:443"));
                assert.ok(thrown.message.includes("code=ECONNREFUSED"));
                return true;
            }
        );
    });

    test("expands AggregateError wrapped in error.cause", () => {
        let innerErr = new Error("connect ETIMEDOUT 10.0.0.1:443");
        innerErr.code = "ETIMEDOUT";

        let aggErr = new AggregateError([innerErr], "AggregateError");
        let outerErr = new Error("Request failed");
        outerErr.cause = aggErr;

        assert.throws(
            () => provider.throwGeneralAxiosError(outerErr),
            (thrown) => {
                assert.ok(thrown.message.includes("caused by:"));
                assert.ok(thrown.message.includes("ETIMEDOUT"));
                assert.ok(thrown.message.includes("10.0.0.1:443"));
                return true;
            }
        );
    });
});
