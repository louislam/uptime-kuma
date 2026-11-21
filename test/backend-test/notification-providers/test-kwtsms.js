const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const Kwtsms = require("../../../server/notification-providers/kwtsms");

describe("kwtSMS notification provider", () => {
    let requests;
    let reply;

    beforeEach(() => {
        requests = [];
        reply = { result: "OK", "msg-id": "abc", numbers: 1, "points-charged": 1, "balance-after": 10 };
        mock.method(axios, "post", async (url, data) => {
            requests.push({ url, data });
            return { status: 200, data: reply };
        });
    });

    afterEach(() => mock.restoreAll());

    const notification = {
        kwtsmsUsername: "user",
        kwtsmsPassword: "pass",
        kwtsmsSenderId: "MY-SENDER",
        kwtsmsToNumber: "+965 5000 0000, 0096550000001",
    };

    test("send() posts JSON to the send API with normalized numbers", async () => {
        const result = await new Kwtsms().send(notification, "[Shop] [🔴 Down] timeout");

        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].url, "https://www.kwtsms.com/API/send/");
        assert.deepStrictEqual(requests[0].data, {
            username: "user",
            password: "pass",
            sender: "MY-SENDER",
            mobile: "96550000000,96550000001",
            message: "[Shop] [Down] timeout",
        });
    });

    test("send() adds test=1 only when test mode is on", async () => {
        await new Kwtsms().send({ ...notification, kwtsmsTestMode: true }, "Test");
        assert.strictEqual(requests[0].data.test, "1");
    });

    test("send() throws the kwtSMS error code when the API refuses", async () => {
        reply = { result: "ERROR", code: "ERR003", description: "Authentication error" };
        await assert.rejects(new Kwtsms().send(notification, "Test"), /ERR003 Authentication error/);
    });

    test("send() splits more than 200 numbers into several requests", async () => {
        const many = Array.from({ length: 201 }, (_, i) => String(96550000000 + i)).join(",");
        await new Kwtsms().send({ ...notification, kwtsmsToNumber: many }, "Test");
        assert.strictEqual(requests.length, 2);
        assert.strictEqual(requests[0].data.mobile.split(",").length, 200);
        assert.strictEqual(requests[1].data.mobile, "96550000200");
    });

    test("parseNumbers() converts Arabic-Indic and Persian digits and removes duplicates", () => {
        const numbers = new Kwtsms().parseNumbers("٩٦٥٥٠٠٠٠٠٠٠ ۹۶۵۵۰۰۰۰۰۰۰;96550000000\n12");
        assert.deepStrictEqual(numbers, ["96550000000"]);
    });

    test("send() throws when no valid number is given", async () => {
        await assert.rejects(
            new Kwtsms().send({ ...notification, kwtsmsToNumber: "abc" }, "Test"),
            /No valid recipient/
        );
    });
});
