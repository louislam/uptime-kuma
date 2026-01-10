const { describe, test } = require("node:test");
const assert = require("node:assert");
const { pingAsync } = require("../../server/util-server");

describe("Ping IDN and IPv6 Support", () => {
    test("pingAsync should handle IDN by converting to Punycode", async () => {
        try {
            await pingAsync("münchen.test-invalid", false, 1, "", true, 56, 1, 1);
        } catch (e) {
            assert.ok(!e.message.includes("Parameter string not correctly encoded"), "Should not have encoding error");
        }
    });

    test("pingAsync should handle IPv6 with brackets by removing them", async () => {
        try {
            await pingAsync("[::1]", true, 1, "", true, 56, 1, 1);
        } catch (e) {
            assert.ok(!e.message.includes("[::1]"), "Should not have brackets in the error message");
        }
    });
});
