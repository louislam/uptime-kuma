const { describe, test } = require("node:test");
const assert = require("node:assert");
const { pingAsync } = require("../../server/util-server");

describe("Server Utilities: pingAsync", () => {
    test("should convert IDN domains to Punycode before pinging", async () => {
        try {
            // timeout 1s
            await pingAsync("münchen.de", false, 1, "", true, 56, 1, 1);
        } catch (e) {
            if (e.message.includes("Parameter string not correctly encoded")) {
                assert.fail("Ping failed with encoding error: IDN was not converted");
            }
            assert.ok(
                e.message.includes("xn--mnchen-3ya.de"),
                `Error message should contain "xn--mnchen-3ya.de". Got: ${e.message}`
            );
        }
    });

    test("should strip brackets from IPv6 addresses before pinging", async () => {
        try {
            // Cloudflare DNS
            await pingAsync("[2606:4700:4700::1111]", true, 1, "", true, 56, 1, 1);
        } catch (e) {
            if (e.message.includes("[2606:4700:4700::1111]")) {
                assert.fail(`Error message contained brackets, implying they were not stripped. Got: ${e.message}`);
            }
            // The error message should contain the raw IP without brackets
            assert.ok(
                e.message.includes("2606:4700:4700::1111"),
                `Error message should contain the raw IP "2606:4700:4700::1111". Got: ${e.message}`
            );
        }
    });

    test("should handle standard ASCII domains correctly", async () => {
        try {
            await pingAsync("google.com", false, 1, "", true, 56, 1, 1);
        } catch (e) {
            if (e.message.includes("Parameter string not correctly encoded")) {
                assert.fail("Ping failed with encoding error for ASCII domain");
            }
            assert.ok(e.message.includes("google.com"), `Error message should contain "google.com". Got: ${e.message}`);
        }
    });
});
