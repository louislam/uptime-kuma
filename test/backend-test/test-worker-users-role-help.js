const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

describe("Worker users role help", () => {
    test("explains each role near the bottom of the Users settings page", () => {
        const usersSource = readSource("src/components/settings/Users.vue");

        assert.match(usersSource, /worker-role-help/);
        assert.match(usersSource, /Role permissions/);
        assert.match(usersSource, /Full access to every Uptime Worker setting, monitor, status page, security control, and user management action\./);
        assert.match(usersSource, /Can create, edit, delete, run, and pause monitors, manage settings, notifications, tags, status pages, network profiles, and clear statistics\. Cannot manage users or security settings\./);
        assert.match(usersSource, /Can view settings and integrations, run or pause monitors, and clear heartbeat history\. Cannot create, edit, or delete monitors or settings\./);
        assert.match(usersSource, /Read-only access to dashboards, monitors, heartbeat history, settings, notifications, tags, proxies, Docker hosts, remote browsers, network profiles, and status pages\./);
        assert.doesNotMatch(usersSource, /worker-role-help dd[\s\S]*\$dark-font-color2/);
    });
});
