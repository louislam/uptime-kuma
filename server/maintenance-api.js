const { R } = require("redbean-node");
const dayjs = require("dayjs");
const apicache = require("./utils/response-cache");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const Maintenance = require("./model/maintenance");
const { log } = require("../src/util");

const server = UptimeKumaServer.getInstance();

const MAX_IDS_PER_REQUEST = 200;

/**
 * Input the request schema cannot judge, e.g. an id that does not exist. Answered with 400.
 */
class MaintenanceInputError extends Error {}

/**
 * Check a timezone value the same way the maintenance model will use it.
 * @param {any} value Input value
 * @returns {boolean} True for SAME_AS_SERVER, UTC or a valid IANA zone name
 */
function isValidTimezone(value) {
    if (value === "SAME_AS_SERVER" || value === "UTC") {
        return true;
    }
    if (typeof value !== "string" || value === "") {
        return false;
    }
    try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Check that every id exists in a table.
 * @param {string} table Internal table name (never user input)
 * @param {number[]} ids Ids to look up
 * @returns {Promise<boolean>} True when all ids exist
 */
async function allIDsExist(table, ids) {
    if (ids.length === 0) {
        return true;
    }
    const placeholders = ids.map(() => "?").join(",");
    const count = await R.getCell(`SELECT COUNT(*) FROM ${table} WHERE id IN (${placeholders})`, ids);
    return Number(count) === ids.length;
}

/**
 * Replace monitor and status page links for a maintenance window.
 * @param {number} maintenanceID Maintenance id
 * @param {number[]} monitorIDs Monitor ids
 * @param {number[]} statusPageIDs Status page ids
 * @returns {Promise<void>}
 */
async function replaceLinks(maintenanceID, monitorIDs, statusPageIDs) {
    await R.exec("DELETE FROM monitor_maintenance WHERE maintenance_id = ?", [maintenanceID]);
    for (const monitorID of monitorIDs) {
        let bean = R.dispense("monitor_maintenance");
        bean.import({ monitor_id: monitorID, maintenance_id: maintenanceID });
        await R.store(bean);
    }

    await R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ?", [maintenanceID]);
    for (const statusPageID of statusPageIDs) {
        let bean = R.dispense("maintenance_status_page");
        bean.import({ status_page_id: statusPageID, maintenance_id: maintenanceID });
        await R.store(bean);
    }
}

/**
 * Kuma stores single-window dates as wall-clock time in the window timezone.
 * Convert an absolute ISO instant (with Z or offset) to that representation.
 * @param {string} isoValue ISO date string
 * @param {string} timezone Timezone of the window
 * @returns {string} Wall-clock "YYYY-MM-DD HH:mm:ss" in the timezone
 */
function toWallClock(isoValue, timezone) {
    return dayjs(isoValue).tz(timezone).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * Remove a half-created maintenance window so a failed request leaves nothing behind.
 * @param {number} maintenanceID Maintenance id
 * @returns {Promise<void>}
 */
async function rollbackMaintenance(maintenanceID) {
    const bean = server.maintenanceList[maintenanceID];
    if (bean) {
        bean.stop();
        delete server.maintenanceList[maintenanceID];
    }
    await R.exec("DELETE FROM maintenance WHERE id = ?", [maintenanceID]);
}

/**
 * Make a stored change visible: drop the cached responses and push the list to the dashboard.
 * The change is already stored at this point, so a failing push is logged and does not fail the request,
 * the same as the socket handlers, which send the list after they have answered.
 * @returns {Promise<void>}
 */
async function refreshDashboard() {
    apicache.clear();
    try {
        await server.sendMaintenanceListToDashboard();
    } catch (e) {
        log.warn("maintenance-api", "Failed to send the maintenance list to the dashboard: " + e.message);
    }
}

/**
 * Create a maintenance window from a request body that already passed the request schema.
 * @param {object} body Validated request body
 * @param {string} userID Owner of the window
 * @returns {Promise<number>} Id of the new maintenance window
 * @throws {MaintenanceInputError} When a monitor or status page id does not exist
 */
async function createMaintenance(body, userID) {
    const monitorIDs = [...new Set(body.monitorIds)];
    const statusPageIDs = [...new Set(body.statusPageIds)];

    if (!(await allIDsExist("monitor", monitorIDs))) {
        throw new MaintenanceInputError("unknown monitor id in monitorIds");
    }
    if (!(await allIDsExist("status_page", statusPageIDs))) {
        throw new MaintenanceInputError("unknown status page id in statusPageIds");
    }

    let startDate = null;
    let endDate = null;
    if (body.strategy === "single") {
        const effectiveZone = body.timezone === "SAME_AS_SERVER" ? await server.getTimezone() : body.timezone;
        startDate = toWallClock(body.start, effectiveZone);
        endDate = toWallClock(body.end, effectiveZone);
    }

    let bean = await Maintenance.jsonToBean(R.dispense("maintenance"), {
        title: body.title,
        description: body.description,
        strategy: body.strategy,
        intervalDay: 1,
        timezoneOption: body.timezone,
        active: body.active,
        dateRange: [startDate, endDate],
        timeRange: [],
        weekdays: [],
        daysOfMonth: [],
        durationMinutes: 0,
        cron: "",
    });
    bean.user_id = userID;
    let maintenanceID = await R.store(bean);

    try {
        await replaceLinks(maintenanceID, monitorIDs, statusPageIDs);

        server.maintenanceList[maintenanceID] = bean;
        await bean.run(true);
    } catch (e) {
        await rollbackMaintenance(maintenanceID);
        throw e;
    }

    await refreshDashboard();
    return maintenanceID;
}

/**
 * Activate or deactivate a maintenance window.
 * @param {object} maintenance Maintenance bean from the running server
 * @param {boolean} active True to resume, false to pause
 * @returns {Promise<void>}
 */
async function setMaintenanceActive(maintenance, active) {
    maintenance.active = active;
    await R.store(maintenance);
    if (active) {
        await maintenance.run();
    } else {
        maintenance.stop();
    }

    await refreshDashboard();
}

/**
 * Delete a maintenance window.
 * @param {number} maintenanceID Maintenance id
 * @returns {Promise<void>}
 */
async function deleteMaintenance(maintenanceID) {
    server.getMaintenance(maintenanceID).stop();
    delete server.maintenanceList[maintenanceID];
    await R.exec("DELETE FROM maintenance WHERE id = ?", [maintenanceID]);

    await refreshDashboard();
}

module.exports = {
    MAX_IDS_PER_REQUEST,
    MaintenanceInputError,
    isValidTimezone,
    createMaintenance,
    setMaintenanceActive,
    deleteMaintenance,
};
