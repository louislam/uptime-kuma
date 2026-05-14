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
            /callback\?\.\(\{\s*ok:\s*true,\s*msg:\s*"Deleted",\s*\.\.\.body\s*\}\)/,
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
            /if \(event === "getTags"\) \{[\s\S]*?collectCloudflareTags\(app\.monitorList\)[\s\S]*?return;/,
            "Worker socket shim should handle getTags instead of showing the unsupported-action toast"
        );

        const helperMatch = source.match(
            /function collectCloudflareTags\(monitorList\) \{[\s\S]*?\n\}\n\n\/\*\*/
        );
        assert.ok(helperMatch, "Worker tag collector should exist");

        const collectCloudflareTags = new Function(`
            ${helperMatch[0].replace(/\n\n\/\*\*$/, "")}
            return collectCloudflareTags;
        `)();

        assert.deepStrictEqual(
            collectCloudflareTags({
                1: {
                    tags: [
                        {
                            tag_id: 5,
                            name: "role",
                            color: "#66bb6a",
                            value: "api",
                        },
                    ],
                },
                2: {
                    tags: [
                        {
                            id: 5,
                            name: "role",
                            color: "#66bb6a",
                            value: "web",
                        },
                        {
                            name: "site",
                            color: "#42a5f5",
                        },
                    ],
                },
            }),
            [
                {
                    id: 5,
                    name: "role",
                    color: "#66bb6a",
                },
                {
                    id: undefined,
                    name: "site",
                    color: "#42a5f5",
                },
            ],
            "tag options should be unique by tag identity and omit monitor-specific values"
        );
    });
});
