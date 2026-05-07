process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");

const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const Monitor = require("../../server/model/monitor");
const { getKnex } = require("../../server/db");

/**
 * Insert a monitor row directly via knex and return the inserted row's id.
 * @param {string} name human-readable monitor name
 * @param {number|null} parent parent monitor id, or null for a root
 * @returns {Promise<number>} the new monitor id
 */
async function insertMonitor(name, parent = null) {
    const inserted = await Monitor.query().insert({
        name,
        type: "group",
        parent,
        interval: 60,
        retry_interval: 60,
        user_id: null,
    });
    return inserted.id;
}

describe("Monitor hierarchy traversal (H-2)", () => {
    const testDb = new TestDB("./data/test-monitor-hierarchy");

    before(() => testDb.create());
    after(() => {
        Settings.stopCacheCleaner();
        return testDb.destroy();
    });

    test("getAllChildrenIDs returns every descendant of a 4-level branching tree", async () => {
        // Build:
        //   root
        //   ├── child_a
        //   │   ├── grand_a1
        //   │   │   └── great_a1a
        //   │   └── grand_a2
        //   └── child_b
        //       └── grand_b1
        const root = await insertMonitor("root");
        const childA = await insertMonitor("child_a", root);
        const childB = await insertMonitor("child_b", root);
        const grandA1 = await insertMonitor("grand_a1", childA);
        const grandA2 = await insertMonitor("grand_a2", childA);
        const grandB1 = await insertMonitor("grand_b1", childB);
        const greatA1a = await insertMonitor("great_a1a", grandA1);

        const all = await Monitor.getAllChildrenIDs(root);
        const sorted = [...all].sort((a, b) => a - b);
        const expected = [childA, childB, grandA1, grandA2, grandB1, greatA1a].sort((a, b) => a - b);
        assert.deepStrictEqual(sorted, expected);

        const subtree = await Monitor.getAllChildrenIDs(childA);
        assert.deepStrictEqual(
            [...subtree].sort((a, b) => a - b),
            [grandA1, grandA2, greatA1a].sort((a, b) => a - b)
        );

        const leaf = await Monitor.getAllChildrenIDs(greatA1a);
        assert.deepStrictEqual(leaf, []);
    });

    test("getAllChildrenIDs is cycle-safe when monitors form a parent loop", async () => {
        // Two monitors that become each other's parent. This shouldn't happen in
        // normal operation but a malformed import or a future bug must not lock
        // the server in an infinite recursion.
        const x = await insertMonitor("cycle_x");
        const y = await insertMonitor("cycle_y", x);

        // Force x.parent = y to create the cycle (y.parent = x already).
        await getKnex()("monitor").where("id", x).update({ parent: y });

        const fromX = await Monitor.getAllChildrenIDs(x);
        const fromY = await Monitor.getAllChildrenIDs(y);

        // Each side reaches the other exactly once and then stops.
        assert.ok(fromX.includes(y), "x should reach y through the cycle");
        assert.ok(fromY.includes(x), "y should reach x through the cycle");
        // No id should appear twice.
        assert.strictEqual(new Set(fromX).size, fromX.length);
        assert.strictEqual(new Set(fromY).size, fromY.length);

        // Break the cycle so other tests/the teardown aren't surprised.
        await getKnex()("monitor").where("id", x).update({ parent: null });
        await getKnex()("monitor").where("id", y).update({ parent: null });
    });

    test("getAllPath walks ancestors via the in-memory adjacency list", async () => {
        const top = await insertMonitor("top");
        const mid = await insertMonitor("mid", top);
        const bottom = await insertMonitor("bottom", mid);

        const bottomRow = await getKnex()("monitor").where("id", bottom).first();
        const path = await Monitor.getAllPath(bottom, bottomRow.name);
        assert.deepStrictEqual(path, ["top", "mid", "bottom"]);
    });

    test("getAllPath does not loop forever on a parent cycle", async () => {
        const a = await insertMonitor("path_a");
        const b = await insertMonitor("path_b", a);
        // Cycle: a -> b -> a
        await getKnex()("monitor").where("id", a).update({ parent: b });

        const aRow = await getKnex()("monitor").where("id", a).first();
        const path = await Monitor.getAllPath(a, aRow.name);
        // Each node appears at most once in the resulting path.
        assert.strictEqual(new Set(path).size, path.length);

        await getKnex()("monitor").where("id", a).update({ parent: null });
        await getKnex()("monitor").where("id", b).update({ parent: null });
    });

    test("preparePreloadData populates childrenIDs and paths from a single load", async () => {
        const root = await insertMonitor("preload_root");
        const mid = await insertMonitor("preload_mid", root);
        const leaf = await insertMonitor("preload_leaf", mid);

        const monitorData = [
            { id: root, name: "preload_root", active: true },
            { id: mid, name: "preload_mid", active: true },
            { id: leaf, name: "preload_leaf", active: true },
        ];

        // The legacy getAllChildrenIDs walked the tree by issuing one
        // `select * from monitor where parent = ?` per visited node. The new
        // implementation must issue zero of these and instead load the full
        // adjacency list (`select id, name, parent from monitor`) exactly once
        // for the entire preload step.
        const knex = getKnex();
        let recursiveByParentCount = 0;
        let adjacencyListLoadCount = 0;
        const listener = (q) => {
            if (typeof q.sql !== "string") {
                return;
            }
            const sql = q.sql.toLowerCase().trim();
            if (/^\s*select\s+\*\s+from\s+["`]?monitor["`]?\s+where\s+["`]?parent["`]?\s*=/.test(sql)) {
                recursiveByParentCount++;
            }
            if (/^\s*select\s+["`]?id["`]?\s*,\s*["`]?name["`]?\s*,\s*["`]?parent["`]?\s+from\s+["`]?monitor["`]?\s*$/.test(sql)) {
                adjacencyListLoadCount++;
            }
        };
        knex.on("query", listener);

        let preload;
        try {
            preload = await Monitor.preparePreloadData(monitorData);
        } finally {
            knex.removeListener("query", listener);
        }

        assert.deepStrictEqual(
            [...preload.childrenIDs.get(root)].sort((a, b) => a - b),
            [mid, leaf].sort((a, b) => a - b)
        );
        assert.deepStrictEqual(preload.childrenIDs.get(mid), [leaf]);
        assert.deepStrictEqual(preload.childrenIDs.get(leaf), []);

        assert.deepStrictEqual(preload.paths.get(leaf), ["preload_root", "preload_mid", "preload_leaf"]);
        assert.deepStrictEqual(preload.paths.get(mid), ["preload_root", "preload_mid"]);
        assert.deepStrictEqual(preload.paths.get(root), ["preload_root"]);

        assert.strictEqual(
            recursiveByParentCount,
            0,
            "preparePreloadData must not issue recursive `where parent = ?` queries"
        );
        assert.strictEqual(
            adjacencyListLoadCount,
            1,
            "preparePreloadData should load the monitor adjacency list exactly once"
        );
    });
});
