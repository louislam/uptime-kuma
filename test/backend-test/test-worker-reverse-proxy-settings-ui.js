const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Worker Reverse Proxy settings UI removal", () => {
    test("allows the About settings page in Worker UI mode", () => {
        const settingsSource = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );

        assert.match(
            settingsSource,
            /"about"/,
            "about should be listed as a Worker-supported settings page"
        );
    });

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

describe("Worker Proxies settings UI", () => {
    test("exposes the Proxies settings page in Worker UI mode", () => {
        const settingsSource = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );

        assert.match(
            settingsSource,
            /"proxies"/,
            "proxies should be listed as a supported Worker settings page"
        );
    });

    test("maps proxy socket events to Worker REST endpoints", () => {
        const socketSource = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(socketSource, /event === "addProxy"/);
        assert.match(socketSource, /event === "deleteProxy"/);
        assert.match(socketSource, /\/api\/proxies/);
    });
});

describe("Worker Monitor History settings UI", () => {
    test("exposes the Monitor History settings page in Worker UI mode", () => {
        const settingsSource = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );

        assert.match(
            settingsSource,
            /"monitor-history"/,
            "monitor-history should be listed as a supported Worker settings page"
        );
    });

    test("maps clear statistics to the Worker REST endpoint", () => {
        const socketSource = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(socketSource, /event === "clearStatistics"/);
        assert.match(socketSource, /\/api\/statistics/);
    });

    test("hides SQLite-only database maintenance in Worker UI mode", () => {
        const componentSource = fs.readFileSync(
            path.join(__dirname, "../../src/components/settings/MonitorHistory.vue"),
            "utf8"
        );

        assert.match(componentSource, /showDatabaseMaintenance/);
        assert.match(componentSource, /!\s*this\.\$root\.isCloudflareWorkerUI/);
    });
});
