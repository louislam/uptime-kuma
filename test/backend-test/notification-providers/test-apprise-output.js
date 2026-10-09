const { describe, test } = require("node:test");
const assert = require("node:assert");

// Stub promisify-child-process before the provider is loaded so we can simulate
// a successful apprise run that prints nothing to stdout (see #5547).
const childProcessPath = require.resolve("promisify-child-process");
require.cache[childProcessPath] = {
    id: childProcessPath,
    filename: childProcessPath,
    loaded: true,
    exports: {
        spawn: () => Promise.resolve({ code: 0, signal: null, stdout: "", stderr: "" }),
    },
};

const Apprise = require("../../../server/notification-providers/apprise");

describe("Apprise notification provider output handling", () => {
    test("send() succeeds when apprise exits 0 without any stdout", async () => {
        const result = await new Apprise().send({ appriseURL: "json://example.com" }, "msg");
        assert.strictEqual(result, "Sent Successfully.");
    });
});
