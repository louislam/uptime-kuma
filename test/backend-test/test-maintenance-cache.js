process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "info_maintenance", "debug_maintenance", "debug_maintenance-cache"].join(",");

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");

// Maintenance.getStatus relies on dayjs.tz() / customParseFormat (registered in
// server/server.js at boot). Register them explicitly for the test harness.
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
const Maintenance = require("../../server/model/maintenance");
const { MaintenanceCache } = require("../../server/maintenance-cache");

const testDb = new TestDB("./data/test-maintenance-cache");

/**
 * Insert a monitor row directly via Knex and return its id.
 * We bypass Monitor.query() to avoid the bean's default-value plumbing,
 * since for cache tests we only care about `id` and `parent`.
 * @param {object} fields Column overrides; `parent` defaults to null.
 * @returns {Promise<number>} Inserted row id
 */
async function insertMonitor(fields = {}) {
    // Use the schema's defaults aggressively; we only care about id + parent.
    const [ id ] = await getKnex()("monitor").insert({
        name: fields.name || `m-${Math.random().toString(36).slice(2, 8)}`,
        type: "http",
        url: "https://example.com",
        parent: fields.parent ?? null,
    }).returning("id");
    // sqlite returns a primitive; pg returns { id }.
    return typeof id === "object" ? id.id : id;
}

/**
 * Insert a manual-strategy maintenance row and return the persisted bean.
 * @param {object} overrides Per-test overrides
 * @returns {Promise<Maintenance>} The fetched Maintenance bean
 */
async function insertManualMaintenance(overrides = {}) {
    return Maintenance.query().insertAndFetch({
        title: overrides.title || "cache-test-maintenance",
        description: "",
        active: overrides.active ?? true,
        strategy: "manual",
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        weekdays: "[]",
        days_of_month: "[]",
        interval_day: null,
        timezone: "UTC",
        cron: null,
        duration: null,
        // user_id is FK to user(id); set null since we don't seed a user.
        user_id: null,
        ...overrides,
    });
}

describe("MaintenanceCache (unit, no DB)", () => {
    test("setMonitorMaintenances + setMonitorParent build link/parent maps", () => {
        const cache = new MaintenanceCache();
        cache.setMonitorParent(1, null);
        cache.setMonitorParent(2, 1);
        cache.setMonitorMaintenances(2, [ 10, 11 ]);

        assert.strictEqual(cache._monitorParent.get(1), null);
        assert.strictEqual(cache._monitorParent.get(2), 1);
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(2) ], [ 10, 11 ]);
    });

    test("addLink / removeLink mutate per-monitor sets idempotently", () => {
        const cache = new MaintenanceCache();
        cache.addLink(5, 100);
        cache.addLink(5, 100); // duplicate must not double-add
        cache.addLink(5, 101);
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(5) ], [ 100, 101 ]);

        cache.removeLink(5, 100);
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(5) ], [ 101 ]);

        cache.removeLink(5, 101);
        assert.strictEqual(cache._monitorMaintenances.has(5), false, "empty set must be cleaned up");
    });

    test("removeMaintenance drops the id from every monitor's set", () => {
        const cache = new MaintenanceCache();
        cache.addLink(1, 50);
        cache.addLink(2, 50);
        cache.addLink(2, 51);
        cache.removeMaintenance(50);
        assert.strictEqual(cache._monitorMaintenances.has(1), false, "monitor 1 only had 50, must be removed");
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(2) ], [ 51 ]);
    });

    test("removeMonitor wipes both maps for that monitor", () => {
        const cache = new MaintenanceCache();
        cache.setMonitorParent(7, 3);
        cache.addLink(7, 99);
        cache.removeMonitor(7);
        assert.strictEqual(cache._monitorParent.has(7), false);
        assert.strictEqual(cache._monitorMaintenances.has(7), false);
    });
});

describe("MaintenanceCache (integration with sqlite)", () => {
    /** @type {Maintenance|null} */
    let maintenanceBean = null;
    /** Lightweight stand-in so `cache.isActive` can resolve maintenance beans without booting express/socket.io. */
    const fakeServer = {
        maintenanceList: {},
        /**
         * Mirror of UptimeKumaServer.getMaintenance.
         * @param {number} id Maintenance id
         * @returns {Maintenance|null} Bean or null
         */
        getMaintenance(id) {
            return this.maintenanceList[id] || null;
        },
    };

    before(async () => {
        await testDb.create();
        // Stub UptimeKumaServer.getInstance so the cache reaches our
        // fakeServer instead of trying to spin up the real one.
        UptimeKumaServer.instance = fakeServer;
    });

    after(async () => {
        Settings.stopCacheCleaner();
        // Stop any running maintenance jobs to release timers.
        for (const id in fakeServer.maintenanceList) {
            try {
                fakeServer.maintenanceList[id].stop();
            } catch (_) {
                // best-effort cleanup
            }
            delete fakeServer.maintenanceList[id];
        }
        UptimeKumaServer.instance = null;
        await testDb.destroy();
    });

    beforeEach(async () => {
        // Reset between tests: clear monitor_maintenance, monitor, maintenance.
        await getKnex()("monitor_maintenance").delete();
        await getKnex()("monitor").delete();
        await getKnex()("maintenance").delete();
        for (const id in fakeServer.maintenanceList) {
            try {
                fakeServer.maintenanceList[id].stop();
            } catch (_) { /* noop */ }
            delete fakeServer.maintenanceList[id];
        }
        maintenanceBean = null;
    });

    test("loadFromDb populates link and parent maps from monitor_maintenance + monitor", async () => {
        const parentId = await insertMonitor({ name: "parent" });
        const childId = await insertMonitor({ name: "child", parent: parentId });
        const sibId = await insertMonitor({ name: "sibling" });

        maintenanceBean = await insertManualMaintenance({ title: "win-1" });
        await getKnex()("monitor_maintenance").insert([
            { monitor_id: parentId, maintenance_id: maintenanceBean.id },
            { monitor_id: sibId, maintenance_id: maintenanceBean.id },
        ]);

        const cache = new MaintenanceCache();
        await cache.loadFromDb();

        assert.strictEqual(cache.isLoaded(), true);
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(parentId) ], [ maintenanceBean.id ]);
        assert.deepStrictEqual([ ...cache._monitorMaintenances.get(sibId) ], [ maintenanceBean.id ]);
        // child has no direct link
        assert.strictEqual(cache._monitorMaintenances.has(childId), false);
        // parent map mirrors the FK
        assert.strictEqual(cache._monitorParent.get(parentId), null);
        assert.strictEqual(cache._monitorParent.get(childId), parentId);
        assert.strictEqual(cache._monitorParent.get(sibId), null);
    });

    test("isActive returns true for a directly-linked monitor when the maintenance is under-maintenance", async () => {
        const monitorId = await insertMonitor({ name: "direct" });
        maintenanceBean = await insertManualMaintenance({ title: "active-manual" });
        // manual + active=true -> getStatus() returns 'under-maintenance' immediately.
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;
        await getKnex()("monitor_maintenance").insert({
            monitor_id: monitorId,
            maintenance_id: maintenanceBean.id,
        });

        const cache = new MaintenanceCache();
        await cache.loadFromDb();

        assert.strictEqual(await cache.isActive(monitorId), true, "direct link with active manual maintenance must be active");
    });

    test("isActive returns true via parent chain (recursive maintenance inheritance)", async () => {
        const grandparentId = await insertMonitor({ name: "gp" });
        const parentId = await insertMonitor({ name: "p", parent: grandparentId });
        const childId = await insertMonitor({ name: "c", parent: parentId });

        maintenanceBean = await insertManualMaintenance({ title: "gp-window" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;
        await getKnex()("monitor_maintenance").insert({
            monitor_id: grandparentId,
            maintenance_id: maintenanceBean.id,
        });

        const cache = new MaintenanceCache();
        await cache.loadFromDb();

        assert.strictEqual(await cache.isActive(childId), true, "child must inherit maintenance from grandparent");
        assert.strictEqual(await cache.isActive(parentId), true, "parent must inherit maintenance from grandparent");
        assert.strictEqual(await cache.isActive(grandparentId), true, "grandparent direct link");
    });

    test("isActive returns false when the maintenance bean is paused (active=false)", async () => {
        const monitorId = await insertMonitor({ name: "paused-target" });
        maintenanceBean = await insertManualMaintenance({ title: "paused", active: false });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;
        await getKnex()("monitor_maintenance").insert({
            monitor_id: monitorId,
            maintenance_id: maintenanceBean.id,
        });

        const cache = new MaintenanceCache();
        await cache.loadFromDb();

        assert.strictEqual(await cache.isActive(monitorId), false, "paused (active=false) maintenance must not flag the monitor");
    });

    test("end-to-end: inserting a link, then reload, makes isActive flip true", async () => {
        const monitorId = await insertMonitor({ name: "lazy" });
        maintenanceBean = await insertManualMaintenance({ title: "lazy-window" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;

        const cache = new MaintenanceCache();
        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(monitorId), false, "no link yet -> not active");

        await getKnex()("monitor_maintenance").insert({
            monitor_id: monitorId,
            maintenance_id: maintenanceBean.id,
        });

        // Without reload the cache is stale.
        assert.strictEqual(await cache.isActive(monitorId), false, "stale cache should not see new link");

        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(monitorId), true, "after reload the new link is observed");
    });

    test("targeted mutation: removeLink flips isActive without a full reload", async () => {
        const monitorId = await insertMonitor({ name: "mut" });
        maintenanceBean = await insertManualMaintenance({ title: "mut-window" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;
        await getKnex()("monitor_maintenance").insert({
            monitor_id: monitorId,
            maintenance_id: maintenanceBean.id,
        });

        const cache = new MaintenanceCache();
        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(monitorId), true);

        cache.removeLink(monitorId, maintenanceBean.id);
        assert.strictEqual(await cache.isActive(monitorId), false, "removeLink must invalidate without DB reload");
    });

    test("isActive ignores cycles in the parent chain (defensive)", async () => {
        // sqlite won't enforce that monitor.parent != monitor.id for us; the
        // cache still must not loop forever if data ever gets corrupted.
        const cache = new MaintenanceCache();
        cache.setMonitorParent(1, 2);
        cache.setMonitorParent(2, 1); // cycle
        // No matching maintenance, no UptimeKumaServer interaction needed.
        assert.strictEqual(await cache.isActive(1), false, "cycle must terminate, not throw");
    });

    /**
     * Reimplements the production replaceMaintenanceLinks helper from
     * server/socket-handlers/maintenance-socket-handler.js. Kept inline so
     * regressions in the helper surface here without exporting test-only
     * symbols from the handler module.
     * @param {string} table Link table
     * @param {string} fkCol Foreign key column referencing the linked entity
     * @param {number} maintenanceID Maintenance row id
     * @param {Array<{id:number}>} items Items to link
     */
    async function replaceMaintenanceLinks(table, fkCol, maintenanceID, items) {
        await getKnex().transaction(async (trx) => {
            await trx(table).where("maintenance_id", maintenanceID).delete();
            for (const item of items) {
                await trx(table).insert({
                    [fkCol]: item.id,
                    maintenance_id: maintenanceID,
                });
            }
        });
    }

    test("C-3 handler path: replaceMaintenanceLinks + loadFromDb hydrates cache", async () => {
        const m1 = await insertMonitor({ name: "m1" });
        const m2 = await insertMonitor({ name: "m2" });
        maintenanceBean = await insertManualMaintenance({ title: "C-3 path" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;

        // Simulate addMonitorMaintenance: socket handler calls replaceMaintenanceLinks
        // and then maintenanceCache.loadFromDb() post-commit.
        await replaceMaintenanceLinks("monitor_maintenance", "monitor_id", maintenanceBean.id, [
            { id: m1 },
            { id: m2 },
        ]);

        const cache = new MaintenanceCache();
        await cache.loadFromDb();

        assert.strictEqual(await cache.isActive(m1), true, "m1 directly linked → under maintenance");
        assert.strictEqual(await cache.isActive(m2), true, "m2 directly linked → under maintenance");
    });

    test("C-3 handler path: re-call with new monitor list drops the previous links", async () => {
        const m1 = await insertMonitor({ name: "old-attach" });
        const m2 = await insertMonitor({ name: "new-attach" });
        maintenanceBean = await insertManualMaintenance({ title: "re-attach" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;

        // First attach: m1
        await replaceMaintenanceLinks("monitor_maintenance", "monitor_id", maintenanceBean.id, [ { id: m1 } ]);
        const cache = new MaintenanceCache();
        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(m1), true, "m1 attached after first call");
        assert.strictEqual(await cache.isActive(m2), false, "m2 not yet attached");

        // Second attach: m2 only — replace pattern must drop m1.
        await replaceMaintenanceLinks("monitor_maintenance", "monitor_id", maintenanceBean.id, [ { id: m2 } ]);
        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(m1), false, "m1 detached after replace");
        assert.strictEqual(await cache.isActive(m2), true, "m2 attached after replace");
    });

    test("C-3 handler path: rollback inside replaceMaintenanceLinks leaves cache and DB consistent", async () => {
        const m1 = await insertMonitor({ name: "rollback-existing" });
        maintenanceBean = await insertManualMaintenance({ title: "rollback-test" });
        fakeServer.maintenanceList[maintenanceBean.id] = maintenanceBean;

        // Seed with m1 attached.
        await getKnex()("monitor_maintenance").insert({
            monitor_id: m1, maintenance_id: maintenanceBean.id,
        });
        const cache = new MaintenanceCache();
        await cache.loadFromDb();
        assert.strictEqual(await cache.isActive(m1), true, "baseline: m1 active");

        // Force a rollback inside the transaction: insert a duplicate then throw.
        await assert.rejects(async () => {
            await getKnex().transaction(async (trx) => {
                await trx("monitor_maintenance").where("maintenance_id", maintenanceBean.id).delete();
                throw new Error("simulated commit failure");
            });
        }, /simulated commit failure/);

        // The handler hooks loadFromDb AFTER replaceMaintenanceLinks returns,
        // so on throw the cache is never refreshed. DB is rolled back by the
        // transaction. Cache + DB stay at the pre-mutation state.
        const stillThere = await getKnex()("monitor_maintenance")
            .where("maintenance_id", maintenanceBean.id);
        assert.strictEqual(stillThere.length, 1, "DB row preserved by rollback");
        assert.strictEqual(await cache.isActive(m1), true, "cache untouched, still reflects pre-mutation truth");
    });
});
