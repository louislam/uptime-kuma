const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const SMSManager = require("../../../server/notification-providers/smsmanager");

describe("SMSManager notification provider", () => {
    let requestedUrls;

    beforeEach(() => {
        requestedUrls = [];
        mock.method(axios, "get", async (url) => {
            requestedUrls.push(url);
            return { status: 200, data: "OK" };
        });
    });

    afterEach(() => mock.restoreAll());

    test("send() passes the configured gateway type to SMSManager", async () => {
        await new SMSManager().send(
            { smsmanagerApiKey: "key", numbers: "420777123456", messageType: "economy" },
            "Test"
        );

        assert.strictEqual(new URL(requestedUrls[0]).searchParams.get("gateway"), "economy");
    });
});
