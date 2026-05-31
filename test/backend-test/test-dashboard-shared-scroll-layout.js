const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

describe("Dashboard shared scroll layout", () => {
    test("lets the dashboard page scroll own the monitor list and detail columns", () => {
        const dashboardSource = readSource("src/pages/Dashboard.vue");
        const monitorListSource = readSource("src/components/MonitorList.vue");

        assert.match(dashboardSource, /<MonitorList\s+:scrollbar="true"\s+:use-page-scroll="true"\s*\/>/);
        assert.match(dashboardSource, /\.dashboard-shell\s*\{[\s\S]*?align-items:\s*stretch;/);
        assert.match(dashboardSource, /\.dashboard-sidebar\s*\{[\s\S]*?display:\s*flex;/);
        assert.match(dashboardSource, /\.dashboard-sidebar\s*\{[\s\S]*?flex-direction:\s*column;/);
        assert.match(monitorListSource, /class="shadow-box mb-3 p-0 monitor-list-box"/);
        assert.match(monitorListSource, /usePageScroll:\s*\{[\s\S]*?type:\s*Boolean,/);
        assert.match(monitorListSource, /scrollbar:\s*scrollbar && !usePageScroll/);
        assert.match(monitorListSource, /if \(this\.usePageScroll && !this\.\$root\.isMobile\) \{[\s\S]*?flex:\s*"1 1 auto",/);
        assert.match(monitorListSource, /if \(this\.usePageScroll && !this\.\$root\.isMobile\) \{[\s\S]*?return \{\};/);
    });
});
