const { log } = require("../src/util");

/**
 * In-memory cache of maintenance/monitor relationships used to avoid
 * hitting the database on every heartbeat (issue H-4).
 *
 * The original `Monitor.isUnderMaintenance(id)` issued at least one
 * SELECT against `monitor_maintenance` per beat, plus recursive
 * SELECTs on `monitor` for parent lookups. At 1k monitors / 60s that
 * is over 1k DB round-trips per minute for data that mutates only when
 * an operator edits a maintenance window.
 *
 * The cache stores two maps:
 *   - `_monitorMaintenances`: monitorId -> Set<maintenanceId>
 *     (mirrors rows in the `monitor_maintenance` join table)
 *   - `_monitorParent`: monitorId -> parentId|null
 *     (mirrors `monitor.parent` for recursive maintenance inheritance)
 *
 * Whether a maintenance is *currently* in its window is still resolved
 * via the in-memory `UptimeKumaServer.maintenanceList` beans (their
 * cron-driven `beanMeta.status`), so this cache only removes the DB
 * lookups, not the runtime state the maintenance scheduler keeps.
 */
class MaintenanceCache {
    /**
     * Construct an empty cache. Call `loadFromDb` once Knex is ready.
     */
    constructor() {
        /** @type {Map<number, Set<number>>} */
        this._monitorMaintenances = new Map();
        /** @type {Map<number, number|null>} */
        this._monitorParent = new Map();
        this._loaded = false;
    }

    /**
     * Populate the cache from the database. Safe to call repeatedly;
     * each call rebuilds both maps from scratch.
     * @param {import("knex").Knex} knex Optional Knex instance (for tests). Defaults to `getKnex()`.
     * @returns {Promise<void>}
     */
    async loadFromDb(knex) {
        const { getKnex } = require("./db");
        const k = knex || getKnex();

        const mmRows = await k("monitor_maintenance").select("monitor_id", "maintenance_id");
        const monitorMaintenances = new Map();
        for (const row of mmRows) {
            const set = monitorMaintenances.get(row.monitor_id) || new Set();
            set.add(row.maintenance_id);
            monitorMaintenances.set(row.monitor_id, set);
        }

        const monitorRows = await k("monitor").select("id", "parent");
        const monitorParent = new Map();
        for (const row of monitorRows) {
            monitorParent.set(row.id, row.parent ?? null);
        }

        this._monitorMaintenances = monitorMaintenances;
        this._monitorParent = monitorParent;
        this._loaded = true;
        log.debug(
            "maintenance-cache",
            `Loaded ${mmRows.length} monitor_maintenance rows for ${monitorParent.size} monitors`,
        );
    }

    /**
     * Has the cache ever been populated?
     * @returns {boolean} true once loadFromDb has completed at least once
     */
    isLoaded() {
        return this._loaded;
    }

    /**
     * Check whether the given monitor is currently under maintenance.
     *
     * Mirrors the recursive parent-walking behaviour of
     * `Monitor.isUnderMaintenance` but with no DB queries:
     *   1. for each maintenance attached to the monitor, ask the
     *      in-memory bean whether it is currently active;
     *   2. if none are, walk up the parent chain and repeat.
     * @param {number} monitorId Monitor id to query
     * @returns {Promise<boolean>} true iff this monitor (or any ancestor) is currently under maintenance
     */
    async isActive(monitorId) {
        const { UptimeKumaServer } = require("./uptime-kuma-server");
        const server = UptimeKumaServer.getInstance();

        const visited = new Set();
        let current = monitorId;
        while (current != null && !visited.has(current)) {
            visited.add(current);
            const ids = this._monitorMaintenances.get(current);
            if (ids && ids.size > 0) {
                for (const maintenanceId of ids) {
                    const maintenance = server.getMaintenance(maintenanceId);
                    if (maintenance && (await maintenance.isUnderMaintenance())) {
                        return true;
                    }
                }
            }
            current = this._monitorParent.get(current) ?? null;
        }
        return false;
    }

    /**
     * Replace the maintenance set for a monitor (typically used by
     * `addMonitorMaintenance`, which deletes the rows for one
     * maintenance and re-inserts them).
     * @param {number} monitorId Monitor id
     * @param {Iterable<number>} maintenanceIds Iterable of maintenance ids attached to that monitor
     * @returns {void}
     */
    setMonitorMaintenances(monitorId, maintenanceIds) {
        this._monitorMaintenances.set(monitorId, new Set(maintenanceIds));
    }

    /**
     * Add a single (monitor, maintenance) link to the cache.
     * @param {number} monitorId Monitor id
     * @param {number} maintenanceId Maintenance id
     * @returns {void}
     */
    addLink(monitorId, maintenanceId) {
        const set = this._monitorMaintenances.get(monitorId) || new Set();
        set.add(maintenanceId);
        this._monitorMaintenances.set(monitorId, set);
    }

    /**
     * Remove a single (monitor, maintenance) link from the cache.
     * @param {number} monitorId Monitor id
     * @param {number} maintenanceId Maintenance id
     * @returns {void}
     */
    removeLink(monitorId, maintenanceId) {
        const set = this._monitorMaintenances.get(monitorId);
        if (set) {
            set.delete(maintenanceId);
            if (set.size === 0) {
                this._monitorMaintenances.delete(monitorId);
            }
        }
    }

    /**
     * Forget every link belonging to a maintenance window (e.g. on delete).
     * @param {number} maintenanceId Maintenance id whose links should be dropped
     * @returns {void}
     */
    removeMaintenance(maintenanceId) {
        for (const [ monitorId, set ] of this._monitorMaintenances) {
            if (set.delete(maintenanceId) && set.size === 0) {
                this._monitorMaintenances.delete(monitorId);
            }
        }
    }

    /**
     * Update the parent pointer for a monitor (call on monitor add/edit/delete).
     * Pass `undefined`/`null` to indicate no parent; pass a positive number for a parent id.
     * Pass `undefined` to remove the entry entirely (e.g. when the monitor is deleted).
     * @param {number} monitorId Monitor id
     * @param {number|null} parentId New parent id or null/undefined
     * @returns {void}
     */
    setMonitorParent(monitorId, parentId) {
        this._monitorParent.set(monitorId, parentId ?? null);
    }

    /**
     * Drop a monitor entirely from the cache (e.g. when it is deleted).
     * @param {number} monitorId Monitor id
     * @returns {void}
     */
    removeMonitor(monitorId) {
        this._monitorMaintenances.delete(monitorId);
        this._monitorParent.delete(monitorId);
    }

    /**
     * Reset the cache. Mostly used by tests.
     * @returns {void}
     */
    clear() {
        this._monitorMaintenances = new Map();
        this._monitorParent = new Map();
        this._loaded = false;
    }
}

module.exports = new MaintenanceCache();
// Expose the class for tests that need a fresh instance.
module.exports.MaintenanceCache = MaintenanceCache;
