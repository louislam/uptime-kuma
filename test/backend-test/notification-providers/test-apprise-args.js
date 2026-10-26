const { describe, test } = require("node:test");
const assert = require("node:assert");

let lastArgs = null;

const childProcessPath = require.resolve("promisify-child-process");
require.cache[childProcessPath] = {
    id: childProcessPath,
    filename: childProcessPath,
    loaded: true,
    exports: {
        spawn: (cmd, args) => {
            lastArgs = args;
            return Promise.resolve({ code: 0, signal: null, stdout: "ok", stderr: "" });
        },
    },
};

const Apprise = require("../../../server/notification-providers/apprise");

describe("Apprise notification provider arguments", () => {
    test("send() puts the URL after -- so it cannot be parsed as a CLI flag", async () => {
        await new Apprise().send({ appriseURL: "--plugin-path=/tmp/evil", title: "The Title" }, "the body");

        assert.deepStrictEqual(lastArgs, ["-vv", "-b", "the body", "-t", "The Title", "--", "--plugin-path=/tmp/evil"]);
    });

    test("send() keeps the URL as the only positional argument", async () => {
        await new Apprise().send({ appriseURL: "json://example.com" }, "msg");
        assert.deepStrictEqual(lastArgs, ["-vv", "-b", "msg", "--", "json://example.com"]);
    });
});
