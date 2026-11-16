import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { toCompactMonitor } = require("../../server/compact-monitor");

/**
 * Build preload data with one monitor
 * @param {object} overrides Map overrides
 * @returns {object} Preload data
 */
function preload(overrides = {}) {
    return {
        paths: new Map([[1, ["Group", "Child"]]]),
        activeStatus: new Map([[1, true]]),
        childrenIDs: new Map([[1, [2, 3]]]),
        tags: new Map([[1, [{ tag_id: 5, name: "env" }]]]),
        ...overrides,
    };
}

describe("toCompactMonitor()", () => {
    test("keeps the fields the dashboard uses", () => {
        const monitor = { id: 1, name: "API", type: "http", parent: null, interval: 60, weight: 2000 };

        const compact = toCompactMonitor(monitor, preload());

        assert.deepStrictEqual(compact, {
            id: 1,
            name: "API",
            type: "http",
            active: true,
            parent: null,
            childrenIDs: [2, 3],
            tags: [{ tag_id: 5, name: "env" }],
            path: ["Group", "Child"],
            pathName: "Group / Child",
            interval: 60,
            weight: 2000,
        });
    });

    test("defaults missing parent, children, tags and path", () => {
        const compact = toCompactMonitor(
            { id: 9, name: "Orphan", type: "group", interval: 60 },
            { paths: new Map(), activeStatus: new Map(), childrenIDs: new Map(), tags: new Map() }
        );

        assert.strictEqual(compact.active, undefined);
        assert.deepStrictEqual(compact.childrenIDs, []);
        assert.deepStrictEqual(compact.tags, []);
        assert.deepStrictEqual(compact.path, []);
        assert.strictEqual(compact.pathName, "");
        assert.strictEqual(compact.parent, null);
        assert.strictEqual(compact.weight, null);
    });

    test("does not include sensitive monitor fields", () => {
        const compact = toCompactMonitor(
            {
                id: 1,
                name: "API",
                type: "http",
                parent: null,
                interval: 60,
                url: "https://secret.example",
                basic_auth_pass: "secret",
            },
            preload()
        );

        assert.strictEqual("url" in compact, false);
        assert.strictEqual("basic_auth_pass" in compact, false);
    });
});
