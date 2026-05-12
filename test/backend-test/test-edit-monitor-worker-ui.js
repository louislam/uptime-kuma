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
});
