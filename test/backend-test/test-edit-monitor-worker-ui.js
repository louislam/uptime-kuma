const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("EditMonitor Worker UI rendering guards", () => {
    test("Ping packet-size warning does not require Socket.IO runtime info", () => {
        const template = fs.readFileSync(
            path.join(__dirname, "../../src/pages/EditMonitor.vue"),
            "utf8"
        );

        assert.doesNotMatch(
            template,
            /\$root\.info\.runtime\.platform\s*===\s*['"]linux['"]\s*&&\s*monitor\.packetSize/,
            "Worker UI does not receive Socket.IO info.runtime; Ping-only fields must guard runtime access"
        );
    });

    test("Edit form hydrates from loaded monitor list before fetching fresh details", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/pages/EditMonitor.vue"),
            "utf8"
        );

        const cachedHydrationIndex = source.indexOf("this.hydrateMonitorFromList();");
        const fetchIndex = source.indexOf("this.$root.getSocket().emit(\"getMonitor\"");

        assert.notStrictEqual(
            cachedHydrationIndex,
            -1,
            "EditMonitor should show the selected monitor from $root.monitorList immediately"
        );
        assert.notStrictEqual(fetchIndex, -1, "EditMonitor should still fetch fresh monitor details");
        assert.ok(
            cachedHydrationIndex < fetchIndex,
            "Cached monitor hydration must happen before the slower per-monitor fetch starts"
        );
    });

    test("Edit page includes a direct back link to the monitor details page", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/pages/EditMonitor.vue"),
            "utf8"
        );

        assert.match(source, /data-testid="edit-monitor-back"/);
        assert.match(source, /v-if="isEdit"/);
        assert.match(source, /:to="monitorDetailsRoute"/);
        assert.match(source, /icon="chevron-left"/);
        assert.match(source, /monitorDetailsRoute\(\)[\s\S]*\/dashboard\/\$\{this\.\$route\.params\.id\}/);
    });

    test("Proxy dialog defaults new proxies to HTTP CONNECT", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/components/ProxyDialog.vue"),
            "utf8"
        );

        assert.match(source, /<option value="http">HTTP<\/option>[\s\S]*<option value="https">HTTPS<\/option>/);
        assert.match(source, /protocol:\s*"http"/);
        assert.doesNotMatch(source, /protocol:\s*"https"/);
    });
});
