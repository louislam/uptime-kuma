const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Worker Reverse Proxy settings UI removal", () => {
    test("does not expose the Reverse Proxy settings page in Worker UI mode", () => {
        const settingsSource = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );
        const routerSource = fs.readFileSync(
            path.join(__dirname, "../../src/router.js"),
            "utf8"
        );

        assert.doesNotMatch(
            settingsSource,
            /"reverse-proxy"/,
            "reverse-proxy should not be listed in settings"
        );
        assert.doesNotMatch(
            settingsSource,
            /Reverse Proxy/,
            "Reverse Proxy should not appear in settings"
        );
        assert.doesNotMatch(
            routerSource,
            /ReverseProxy/,
            "Reverse Proxy route component should not be imported"
        );
        assert.doesNotMatch(
            routerSource,
            /path:\s*"reverse-proxy"/,
            "Reverse Proxy route should not be registered"
        );
    });

    test("removes the Reverse Proxy settings component", () => {
        const componentPath = path.join(__dirname, "../../src/components/settings/ReverseProxy.vue");

        assert.strictEqual(
            fs.existsSync(componentPath),
            false,
            "Reverse Proxy settings component should be removed"
        );
    });
});
