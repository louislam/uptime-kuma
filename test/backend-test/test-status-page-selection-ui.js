const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Status page group and monitor selection UI", () => {
    test("editor picker separates monitor groups from individual monitors", () => {
        const source = fs.readFileSync(path.join(__dirname, "../../src/pages/StatusPage.vue"), "utf8");

        assert.match(source, /group-values="options"/);
        assert.match(source, /\$t\("Monitor Groups"\)/);
        assert.match(source, /\$t\("Individual Monitors"\)/);
        assert.match(source, /canSelectStatusPageMonitor\(monitor\)/);
        assert.match(source, /hasSelectedStatusPageAncestor\(monitor\)/);
        assert.match(source, /hasSelectedStatusPageDescendant\(monitor\)/);
    });

    test("Worker socket bridge persists status page edits through the Worker API", () => {
        const source = fs.readFileSync(path.join(__dirname, "../../src/mixins/socket.js"), "utf8");

        assert.match(source, /event === "saveStatusPage"/);
        assert.match(source, /\/api\/status-page\/\$\{slug \|\| "default"\}/);
        assert.match(source, /method: "PUT"/);
        assert.match(source, /publicGroupList/);
        assert.match(source, /await app\.loadCloudflareWorkerData\(\)/);
    });

    test("public group rows pass monitor metadata to the heartbeat bar", () => {
        const publicGroupList = fs.readFileSync(
            path.join(__dirname, "../../src/components/PublicGroupList.vue"),
            "utf8"
        );
        const heartbeatBar = fs.readFileSync(path.join(__dirname, "../../src/components/HeartbeatBar.vue"), "utf8");
        const uptime = fs.readFileSync(path.join(__dirname, "../../src/components/Uptime.vue"), "utf8");

        assert.match(publicGroupList, /:monitor="monitor\.element"/);
        assert.match(heartbeatBar, /monitor:\s*\{\s*type: Object/);
        assert.match(heartbeatBar, /this\.monitor \|\| this\.\$root\.monitorList/);
        assert.match(uptime, /this\.groupChildMonitors\.length > 0/);
        assert.match(uptime, /this\.\$root\.uptimeList\[`\$\{this\.monitor\.id}_\$\{this\.type}`\]/);
    });
});
