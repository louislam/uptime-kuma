import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Monitor = require("../../server/model/monitor");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");

const originals = {
    getAll: R.getAll,
    getMonitorNotification: Monitor.getMonitorNotification,
    getMonitorTag: Monitor.getMonitorTag,
    getInstance: UptimeKumaServer.getInstance,
};

afterEach(() => {
    R.getAll = originals.getAll;
    Monitor.getMonitorNotification = originals.getMonitorNotification;
    Monitor.getMonitorTag = originals.getMonitorTag;
    UptimeKumaServer.getInstance = originals.getInstance;
});

/**
 * Stub the database and the maintenance registry
 * @param {Array} monitors All monitor rows
 * @param {Array} maintenanceRows monitor_id/maintenance_id rows
 * @param {Map} maintenanceById Maintenance id to maintenance object
 * @param {Array} tags monitor tag rows
 * @param {Array} notifications monitor notification rows
 * @returns {void}
 */
function stubPreload(monitors, maintenanceRows, maintenanceById, { tags = [], notifications = [] } = {}) {
    Monitor.getMonitorNotification = async () => notifications;
    Monitor.getMonitorTag = async () => tags;
    R.getAll = async (sql) => (sql.includes("monitor_maintenance") ? maintenanceRows : monitors);
    UptimeKumaServer.getInstance = () => ({
        getMaintenance: (id) => maintenanceById.get(id),
    });
}

/**
 * Plain monitor rows as returned by the preload query
 * @param {number} id Monitor id
 * @param {object} fields Overrides
 * @returns {object} Monitor row
 */
function monitorRow(id, fields = {}) {
    return { id, name: `Monitor ${id}`, parent: null, active: 1, ...fields };
}

describe("Monitor.preparePreloadData()", () => {
    test("returns empty maps without monitors", async () => {
        const result = await Monitor.preparePreloadData([]);

        assert.strictEqual(result.paths.size, 0);
        assert.strictEqual(result.childrenIDs.size, 0);
        assert.strictEqual(result.activeStatus.size, 0);
    });

    test("builds paths, children and effective active state from the hierarchy", async () => {
        const monitors = [
            monitorRow(1, { name: "Group" }),
            monitorRow(2, { name: "Child", parent: 1 }),
            monitorRow(3, { name: "Grandchild", parent: 2, active: 0 }),
            monitorRow(4, { name: "Sibling", parent: 1 }),
        ];
        stubPreload(monitors, [], new Map());

        const result = await Monitor.preparePreloadData(monitors);

        assert.deepStrictEqual(result.paths.get(3), ["Group", "Child", "Grandchild"]);
        assert.deepStrictEqual(result.paths.get(4), ["Group", "Sibling"]);
        assert.deepStrictEqual(result.childrenIDs.get(1), [2, 3, 4]);
        assert.strictEqual(result.activeStatus.get(1), true);
        assert.strictEqual(result.activeStatus.get(3), false);
        assert.strictEqual(result.forceInactive.get(3), false);
    });

    test("marks children of an inactive group as force inactive", async () => {
        const monitors = [monitorRow(1, { active: 0 }), monitorRow(2, { parent: 1 })];
        stubPreload(monitors, [], new Map());

        const result = await Monitor.preparePreloadData(monitors);

        assert.strictEqual(result.activeStatus.get(2), false);
        assert.strictEqual(result.forceInactive.get(2), true);
        assert.strictEqual(result.forceInactive.get(1), false);
    });

    test("inherits maintenance from the parent group", async () => {
        const monitors = [monitorRow(1), monitorRow(2, { parent: 1 }), monitorRow(3, { parent: 2 })];
        const maintenanceRows = [{ monitor_id: 2, maintenance_id: 10 }];
        const maintenance = new Map([[10, { isUnderMaintenance: async () => true }]]);
        stubPreload(monitors, maintenanceRows, maintenance);

        const result = await Monitor.preparePreloadData(monitors);

        assert.strictEqual(result.maintenanceStatus.get(1), false);
        assert.strictEqual(result.maintenanceStatus.get(2), true);
        assert.strictEqual(result.maintenanceStatus.get(3), true);
    });

    test("ignores a maintenance window that is not active", async () => {
        const monitors = [monitorRow(1)];
        const maintenance = new Map([[10, { isUnderMaintenance: async () => false }]]);
        stubPreload(monitors, [{ monitor_id: 1, maintenance_id: 10 }], maintenance);

        const result = await Monitor.preparePreloadData(monitors);

        assert.strictEqual(result.maintenanceStatus.get(1), false);
    });

    test("returns an empty path for a monitor missing from the hierarchy", async () => {
        const monitor = monitorRow(9, { name: "Ghost" });
        // The monitor list does not contain this id
        stubPreload([monitorRow(1)], [], new Map());

        const result = await Monitor.preparePreloadData([monitor]);

        assert.deepStrictEqual(result.paths.get(9), []);
        assert.deepStrictEqual(result.childrenIDs.get(9), []);
    });

    test("maps tags and notifications by monitor", async () => {
        const monitors = [monitorRow(1)];
        stubPreload(monitors, [], new Map(), {
            tags: [{ monitor_id: 1, tag_id: 5, value: "prod", name: "env", color: "#fff" }],
            notifications: [{ monitor_id: 1, notification_id: 9 }],
        });

        const result = await Monitor.preparePreloadData(monitors);

        assert.deepStrictEqual(result.tags.get(1), [
            { tag_id: 5, monitor_id: 1, value: "prod", name: "env", color: "#fff" },
        ]);
        assert.deepStrictEqual(result.notifications.get(1), { 9: true });
    });
});
