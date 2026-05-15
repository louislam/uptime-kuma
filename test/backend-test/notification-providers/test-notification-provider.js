const { describe, test } = require("node:test");
const assert = require("node:assert");

const NotificationProvider = require("../../../server/notification-providers/notification-provider");

describe("NotificationProvider.renderTemplate() - json filter", () => {
    const provider = new NotificationProvider();

    test("json filter serializes a plain string", async () => {
        const result = await provider.renderTemplate('{"body": {{ msg | json }}}', "hello", null, null);
        assert.strictEqual(result, '{"body": "hello"}');
        assert.doesNotThrow(() => JSON.parse(result));
    });

    test("json filter escapes newlines so the output is valid JSON", async () => {
        const result = await provider.renderTemplate('{"body": {{ msg | json }}}', "line1\nline2", null, null);
        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.body, "line1\nline2");
    });

    test("json filter escapes double quotes", async () => {
        const result = await provider.renderTemplate('{"body": {{ msg | json }}}', 'say "hello"', null, null);
        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.body, 'say "hello"');
    });

    test("json filter escapes backslashes", async () => {
        const result = await provider.renderTemplate('{"body": {{ msg | json }}}', "C:\\path\\file", null, null);
        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.body, "C:\\path\\file");
    });
});

describe("NotificationProvider.throwGeneralAxiosError()", () => {
    const provider = new NotificationProvider();

    test("expands AggregateError causes", () => {
        let err1 = new Error("connect ECONNREFUSED 127.0.0.1:443");
        err1.code = "ECONNREFUSED";
        let err2 = new Error("connect ECONNREFUSED ::1:443");
        err2.code = "ECONNREFUSED";

        let aggErr = new AggregateError([err1, err2], "AggregateError");

        assert.throws(() => provider.throwGeneralAxiosError(aggErr), {
            message: /^AggregateError - caused by: .+/,
        });
    });

    test("expands AggregateError wrapped in error.cause", () => {
        let innerErr = new Error("connect ETIMEDOUT 10.0.0.1:443");
        innerErr.code = "ETIMEDOUT";

        let aggErr = new AggregateError([innerErr], "AggregateError");
        let outerErr = new Error("Request failed");
        outerErr.cause = aggErr;

        assert.throws(() => provider.throwGeneralAxiosError(outerErr), {
            message: /^Request failed - caused by: .+/,
        });
    });
});
