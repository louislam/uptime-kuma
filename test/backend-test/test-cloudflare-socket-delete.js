const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Cloudflare Worker socket delete shim", () => {
    test("recognizes the production custom domain as Worker UI mode", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(source, /"uptimeworker\.wgsglobal\.workers\.dev"/);
        assert.match(source, /"uptime\.wgsglobal\.app"/);
        assert.match(source, /"up\.wgsglobal\.app"/);
    });

    test("normalizes successful REST delete responses for Socket.IO callers", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        const deleteBlockMatch = source.match(/if \(event === "deleteMonitor"\) \{[\s\S]*?return;\n\s+\}/);
        assert.ok(deleteBlockMatch, "deleteMonitor handler should exist in the Worker socket shim");

        const deleteBlock = deleteBlockMatch[0];

        assert.match(deleteBlock, /method:\s*"DELETE"/, "deleteMonitor should still call the REST DELETE endpoint");
        assert.match(
            deleteBlock,
            /finishCloudflareWorkerMutation\(app, callback, \{\s*ok:\s*true,\s*msg:\s*"Deleted",\s*\.\.\.body,\s*\}/,
            "successful REST delete responses must be normalized to Socket.IO's ok:true response shape"
        );
    });

    test("normalizes Worker heartbeat history to oldest-first for live state", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        const helperMatch = source.match(
            /function normalizeCloudflareHeartbeatHistory\(heartbeats\) \{[\s\S]*?\n\}/
        );
        assert.ok(helperMatch, "Worker heartbeat history normalizer should exist");

        const normalizeCloudflareHeartbeatHistory = new Function(`
            ${helperMatch[0]}
            return normalizeCloudflareHeartbeatHistory;
        `)();
        const newestFirst = [
            {
                monitorID: 7,
                status: 1,
                time: "2026-05-12 03:40:27",
            },
            {
                monitorID: 7,
                status: 0,
                time: "2026-05-12 03:39:27",
            },
        ];

        const normalized = normalizeCloudflareHeartbeatHistory(newestFirst);

        assert.deepStrictEqual(
            normalized.map((heartbeat) => heartbeat.status),
            [0, 1],
            "live heartbeat history should render older down checks before the latest up check"
        );
        assert.strictEqual(
            normalized.at(-1).status,
            1,
            "latest heartbeat should remain the final live-history entry"
        );
        assert.deepStrictEqual(
            newestFirst.map((heartbeat) => heartbeat.status),
            [1, 0],
            "normalization should not mutate the paged API order"
        );
    });

    test("handles tag lookups used during Worker monitor saves", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(
            source,
            /if \(event === "getTags"\) \{[\s\S]*?requestCloudflareJson\("\/api\/tags"\)[\s\S]*?return;/,
            "Worker socket shim should handle getTags through the Worker tags API"
        );
        assert.match(source, /if \(event === "addTag"\) \{[\s\S]*?requestCloudflareJson\("\/api\/tags"/);
        assert.match(source, /if \(event === "editTag"\) \{[\s\S]*?`\/api\/tags\/\$\{tag\.id\}`/);
        assert.match(source, /if \(event === "deleteTag"\) \{[\s\S]*?`\/api\/tags\/\$\{args\[0\]\}`/);
        assert.match(
            source,
            /if \(event === "addMonitorTag"\) \{[\s\S]*?`\/api\/monitors\/\$\{monitorId\}\/tags`/
        );
        assert.match(
            source,
            /if \(event === "deleteMonitorTag"\) \{[\s\S]*?`\/api\/monitors\/\$\{monitorId\}\/tags`/
        );
    });

    test("acknowledges Worker UI mutations before scheduling dashboard refreshes", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );
        const stubStart = source.indexOf("function createCloudflareSocketStub");
        const stubEnd = source.indexOf("/**\n * Fetch heartbeat rows", stubStart);
        const stubSource = source.slice(stubStart, stubEnd);
        const editBlockMatch = stubSource.match(/if \(event === "editMonitor"\) \{[\s\S]*?return;\n\s+\}/);

        assert.ok(editBlockMatch, "editMonitor handler should exist in the Worker socket shim");
        assert.doesNotMatch(
            stubSource,
            /await app\.loadCloudflareWorkerData\(\)/,
            "Worker UI action callbacks should not wait for a full dashboard reload"
        );
        assert.match(stubSource, /scheduleCloudflareWorkerDataRefresh\(app/);
        assert.match(stubSource, /finishCloudflareWorkerMutation\(app, callback, body/);
        assert.ok(
            editBlockMatch[0].indexOf("finishCloudflareWorkerMutation(app, callback, body") <
                editBlockMatch[0].indexOf("return;"),
            "editMonitor should finish the user action before returning"
        );
    });

    test("falls back to cached Worker heartbeat history when event-log API requests fail", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(source, /import \{\s*buildCloudflareImportantHeartbeatResult,\s*\} from "\.\.\/util\/cloudflare-important-heartbeats\.mjs";/);
        assert.match(source, /countCloudflareHeartbeats\(app, monitorID\)/);
        assert.match(source, /getCloudflareHeartbeatPageResult\(app, monitorID, offset, count\)/);
        assert.match(
            source,
            /buildCloudflareImportantHeartbeatResult\(app\.monitorList, app\.heartbeatList, monitorID, 0, 1\)\.count/,
            "event count fallback should derive from cached dashboard heartbeat history"
        );
        assert.match(
            source,
            /return buildCloudflareImportantHeartbeatResult\(app\.monitorList, app\.heartbeatList, monitorID, offset, count\);/,
            "event page fallback should derive rows and count from cached dashboard heartbeat history"
        );
    });
});
