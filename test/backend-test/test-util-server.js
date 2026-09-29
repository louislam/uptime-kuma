const { describe, test } = require("node:test");
const assert = require("node:assert");
const { pingAsync } = require("../../server/util-server");

describe("Server Utilities: pingAsync", () => {
    test("should convert IDN domains to Punycode before pinging", async () => {
        const idnDomain = "münchen.de";
        const punycodeDomain = "xn--mnchen-3ya.de";

        await assert.rejects(pingAsync(idnDomain, false, 1, "", true, 56, 1, 1), (err) => {
            if (err.message.includes("Parameter string not correctly encoded")) {
                assert.fail("Ping failed with encoding error: IDN was not converted");
            }
            assert.ok(
                err.message.includes(punycodeDomain),
                `Error message should contain the Punycode domain "${punycodeDomain}". Got: ${err.message}`
            );
            return true;
        });
    });

    test("should strip brackets from IPv6 addresses before pinging", async () => {
        const ipv6WithBrackets = "[2606:4700:4700::1111]";
        const ipv6Raw = "2606:4700:4700::1111";

        try {
            // If IPv6 is reachable, pingAsync resolves successfully, proving brackets were stripped
            const time = await pingAsync(ipv6WithBrackets, true, 1, "", true, 56, 1, 1);
            assert.ok(typeof time === "number" || typeof time === "string", "Ping should return a valid time");
        } catch (err) {
            assert.strictEqual(
                err.message.includes(ipv6WithBrackets),
                false,
                "Error message should not contain brackets"
            );
            // Allow either the IP in the message (local) OR "Network is unreachable"
            const containsIP = err.message.includes(ipv6Raw);
            const isUnreachable =
                err.message.includes("Network is unreachable") || err.message.includes("Network unreachable");
            // macOS error when IPv6 stack is missing
            const isMacOSError = err.message.includes("nodename nor servname provided");
            assert.ok(
                containsIP || isUnreachable || isMacOSError,
                `Ping failed correctly, but error message format was unexpected.\nGot: "${err.message}"\nExpected to contain IP "${ipv6Raw}" OR be a standard network error.`
            );
        }
    });

    test("should handle standard ASCII domains correctly", async () => {
        const domain = "invalid-domain.test";
        await assert.rejects(pingAsync(domain, false, 1, "", true, 56, 1, 1), (err) => {
            assert.strictEqual(err.message.includes("Parameter string not correctly encoded"), false);
            assert.ok(
                err.message.includes(domain),
                `Error message should contain the domain "${domain}". Got: ${err.message}`
            );
            return true;
        });
    });
});
