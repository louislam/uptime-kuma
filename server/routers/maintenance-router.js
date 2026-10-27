let express = require("express");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const { RateLimiter } = require("limiter");
const apicache = require("../modules/apicache");
const { apiAuth } = require("../auth");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const Maintenance = require("../model/maintenance");
const { log } = require("../../src/util");

let router = express.Router();

const server = UptimeKumaServer.getInstance();

const ALLOWED_STRATEGIES = ["manual", "single"];
const MAX_MONITORS_PER_REQUEST = 200;
const MAX_REQUESTS_PER_MINUTE = 120;

/**
 * Resolve the owner of API-created maintenance windows. Kuma runs single-user in practice.
 * @returns {Promise<string|null>} Id of the first admin user
 */
async function getOwnerUserID() {
    return await R.getCell("SELECT id FROM better_auth_user WHERE role = 'admin' AND banned = 0 ORDER BY createdAt");
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
    for (const monitorID of new Set(monitorIDs)) {
        let bean = R.dispense("monitor_maintenance");
        bean.import({ monitor_id: monitorID, maintenance_id: maintenanceID });
        await R.store(bean);
    }

    await R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ?", [maintenanceID]);
    for (const statusPageID of new Set(statusPageIDs)) {
        let bean = R.dispense("maintenance_status_page");
        bean.import({ status_page_id: statusPageID, maintenance_id: maintenanceID });
        await R.store(bean);
    }
}

/**
 * Validate an array of positive integer ids.
 * @param {any} value Input value
 * @returns {boolean} Valid?
 */
function isIdList(value) {
    return (
        Array.isArray(value) &&
        value.length <= MAX_MONITORS_PER_REQUEST &&
        value.every((id) => Number.isInteger(id) && id > 0)
    );
}

/**
 * Check that every id exists in a table.
 * @param {string} table Internal table name (never user input)
 * @param {number[]} ids Ids to look up
 * @returns {Promise<boolean>} True when all ids exist
 */
async function allIDsExist(table, ids) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
        return true;
    }
    const placeholders = unique.map(() => "?").join(",");
    const count = await R.getCell(`SELECT COUNT(*) FROM ${table} WHERE id IN (${placeholders})`, unique);
    return Number(count) === unique.length;
}

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
 * Parse an ISO date string, or null when missing or invalid.
 * @param {any} value Input value
 * @returns {string|null} Date string or null
 */
function parseDate(value) {
    if (typeof value !== "string") {
        return null;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : value;
}

// Own limiter: the shared apiRateLimiter is checked with 0 tokens in apiAuth and can never reject.
const rateLimiter = new RateLimiter({
    tokensPerInterval: MAX_REQUESTS_PER_MINUTE,
    interval: "minute",
    fireImmediately: true,
});

router.use("/api/maintenance", async (_request, response, next) => {
    if ((await rateLimiter.removeTokens(1)) < 0) {
        return response.status(429).json({ ok: false, msg: "Too many requests" });
    }
    next();
});

router.use("/api/maintenance", apiAuth);

router.get("/api/maintenance", async (_request, response) => {
    try {
        const list = await server.getMaintenanceJSONList();
        response.json({ ok: true, maintenance: Object.values(list) });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

router.get("/api/maintenance/:id", async (request, response) => {
    try {
        const maintenance = findMaintenance(request.params.id);
        if (!maintenance) {
            return response.status(404).json({ ok: false, msg: "Maintenance not found" });
        }
        response.json({ ok: true, maintenance: await maintenance.toJSON() });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

router.post("/api/maintenance", async (request, response) => {
    try {
        const body = request.body || {};
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const strategy = body.strategy || "manual";
        const monitorIDs = body.monitorIds ?? [];
        const statusPageIDs = body.statusPageIds ?? [];

        if (title === "" || title.length > 150) {
            return response.status(400).json({ ok: false, msg: "title required, max 150 chars" });
        }
        if (!ALLOWED_STRATEGIES.includes(strategy)) {
            return response.status(400).json({ ok: false, msg: "strategy must be manual or single" });
        }
        if (!isIdList(monitorIDs) || !isIdList(statusPageIDs)) {
            return response.status(400).json({ ok: false, msg: "monitorIds/statusPageIds must be id arrays" });
        }
        if (!(await allIDsExist("monitor", monitorIDs))) {
            return response.status(400).json({ ok: false, msg: "unknown monitor id in monitorIds" });
        }
        if (!(await allIDsExist("status_page", statusPageIDs))) {
            return response.status(400).json({ ok: false, msg: "unknown status page id in statusPageIds" });
        }

        if (body.timezone !== undefined && !isValidTimezone(body.timezone)) {
            return response
                .status(400)
                .json({ ok: false, msg: "timezone must be UTC, SAME_AS_SERVER or an IANA name" });
        }
        const timezone = body.timezone ?? "SAME_AS_SERVER";

        let startDate = null;
        let endDate = null;
        if (strategy === "single") {
            const start = parseDate(body.start);
            const end = parseDate(body.end);
            if (!start || !end || new Date(end) <= new Date(start)) {
                return response.status(400).json({ ok: false, msg: "single needs start and end, end after start" });
            }
            const effectiveZone = timezone === "SAME_AS_SERVER" ? await server.getTimezone() : timezone;
            startDate = toWallClock(start, effectiveZone);
            endDate = toWallClock(end, effectiveZone);
        }

        const userID = await getOwnerUserID();
        const obj = {
            title,
            description: typeof body.description === "string" ? body.description : "",
            strategy,
            intervalDay: 1,
            timezoneOption: timezone,
            active: body.active === true,
            dateRange: [startDate, endDate],
            timeRange: [],
            weekdays: [],
            daysOfMonth: [],
            durationMinutes: 0,
            cron: "",
        };

        let bean = await Maintenance.jsonToBean(R.dispense("maintenance"), obj);
        bean.user_id = userID;
        let maintenanceID = await R.store(bean);

        try {
            await replaceLinks(maintenanceID, monitorIDs, statusPageIDs);

            server.maintenanceList[maintenanceID] = bean;
            await bean.run(true);

            apicache.clear();
            await server.sendMaintenanceListByUserID(userID);
        } catch (e) {
            await rollbackMaintenance(maintenanceID);
            throw e;
        }

        response.status(201).json({ ok: true, maintenanceID });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

/**
 * Load a maintenance by id from the running server.
 * @param {string} id Maintenance id from URL
 * @returns {object|null} Maintenance bean or null
 */
function findMaintenance(id) {
    return server.getMaintenance(Number(id));
}

router.post("/api/maintenance/:id/resume", async (request, response) => {
    try {
        const maintenance = findMaintenance(request.params.id);
        if (!maintenance) {
            return response.status(404).json({ ok: false, msg: "Maintenance not found" });
        }

        maintenance.active = true;
        await R.store(maintenance);
        await maintenance.run();

        apicache.clear();
        await server.sendMaintenanceListByUserID(maintenance.user_id);

        response.json({ ok: true, maintenanceID: maintenance.id, active: true });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

router.post("/api/maintenance/:id/pause", async (request, response) => {
    try {
        const maintenance = findMaintenance(request.params.id);
        if (!maintenance) {
            return response.status(404).json({ ok: false, msg: "Maintenance not found" });
        }

        maintenance.active = false;
        await R.store(maintenance);
        maintenance.stop();

        apicache.clear();
        await server.sendMaintenanceListByUserID(maintenance.user_id);

        response.json({ ok: true, maintenanceID: maintenance.id, active: false });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

router.delete("/api/maintenance/:id", async (request, response) => {
    try {
        const maintenanceID = Number(request.params.id);
        const maintenance = server.getMaintenance(maintenanceID);
        if (!maintenance) {
            return response.status(404).json({ ok: false, msg: "Maintenance not found" });
        }

        const userID = maintenance.user_id;
        maintenance.stop();
        delete server.maintenanceList[maintenanceID];
        await R.exec("DELETE FROM maintenance WHERE id = ?", [maintenanceID]);

        apicache.clear();
        await server.sendMaintenanceListByUserID(userID);

        response.json({ ok: true, maintenanceID });
    } catch (e) {
        log.error("maintenance-api", e);
        response.status(500).json({ ok: false, msg: "Internal error" });
    }
});

module.exports = router;
