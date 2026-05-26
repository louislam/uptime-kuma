const DOWN = 0;
const UP = 1;
const PENDING = 2;

/**
 * Build a paged important-event result from cached Worker dashboard state.
 * @param {object} monitorList Cached monitor rows keyed by monitor ID.
 * @param {object} heartbeatList Cached heartbeat rows keyed by monitor ID.
 * @param {number|string|null} monitorID Monitor ID, or null for all active monitors.
 * @param {number} offset Pagination offset.
 * @param {number} count Page size.
 * @returns {{ count: number, heartbeats: object[] }} Paged important heartbeat result.
 */
export function buildCloudflareImportantHeartbeatResult(
    monitorList = {},
    heartbeatList = {},
    monitorID = null,
    offset = 0,
    count = 25
) {
    const heartbeats = buildCloudflareImportantHeartbeatRows(monitorList, heartbeatList, monitorID);
    const start = Math.max(0, Number(offset) || 0);
    const limit = Math.max(1, Math.min(500, Number(count) || 25));

    return {
        count: heartbeats.length,
        heartbeats: heartbeats.slice(start, start + limit),
    };
}

/**
 * Build newest-first important event rows from cached Worker heartbeat history.
 * @param {object} monitorList Cached monitor rows keyed by monitor ID.
 * @param {object} heartbeatList Cached heartbeat rows keyed by monitor ID.
 * @param {number|string|null} monitorID Monitor ID, or null for all active monitors.
 * @returns {object[]} Important heartbeat rows, newest first.
 */
function buildCloudflareImportantHeartbeatRows(monitorList = {}, heartbeatList = {}, monitorID = null) {
    const monitorIDs = monitorID == null ? Object.keys(monitorList) : [String(monitorID)];
    const importantHeartbeats = [];

    for (const id of monitorIDs) {
        const monitor = monitorList[id];
        if (!isActiveMonitor(monitor)) {
            continue;
        }

        const heartbeats = Array.isArray(heartbeatList[id]) ? heartbeatList[id] : [];
        importantHeartbeats.push(...filterImportantHeartbeats(heartbeats, id));
    }

    return importantHeartbeats.sort(compareHeartbeatsNewestFirst);
}

/**
 * Filter one monitor's cached history down to down, pending, and recovery events.
 * @param {object[]} heartbeats Cached heartbeat rows for one monitor.
 * @param {number|string} monitorID Monitor ID used when cached rows omit monitorID.
 * @returns {object[]} Important heartbeat rows.
 */
function filterImportantHeartbeats(heartbeats, monitorID) {
    const importantHeartbeats = [];
    let previousStatus = null;

    for (const heartbeat of heartbeats.slice().sort(compareHeartbeatsOldestFirst)) {
        const status = Number(heartbeat.status);
        if (status === DOWN || status === PENDING || (status === UP && isDegradedStatus(previousStatus))) {
            importantHeartbeats.push(normalizeHeartbeat(heartbeat, monitorID));
        }
        previousStatus = status;
    }

    return importantHeartbeats;
}

/**
 * Check if a monitor is active enough for dashboard event logs.
 * @param {object|undefined} monitor Monitor row.
 * @returns {boolean} True when the monitor should contribute events.
 */
function isActiveMonitor(monitor) {
    return !!monitor && monitor.active !== false && monitor.active !== 0;
}

/**
 * Normalize cached rows to the shape used by dashboard event tables.
 * @param {object} heartbeat Cached heartbeat row.
 * @param {number|string} monitorID Monitor ID used when the row omits one.
 * @returns {object} Normalized heartbeat row.
 */
function normalizeHeartbeat(heartbeat, monitorID) {
    return {
        ...heartbeat,
        monitorID: Number(heartbeat.monitorID ?? heartbeat.monitor_id ?? monitorID),
        time: heartbeat.time ?? heartbeat.checked_at,
    };
}

/**
 * @param {number|null} status Previous heartbeat status.
 * @returns {boolean} True when the status is down or pending.
 */
function isDegradedStatus(status) {
    return status === DOWN || status === PENDING;
}

/**
 * @param {object} a First heartbeat.
 * @param {object} b Second heartbeat.
 * @returns {number} Sort order from oldest to newest.
 */
function compareHeartbeatsOldestFirst(a, b) {
    return compareHeartbeatTime(a, b) || compareHeartbeatId(a, b);
}

/**
 * @param {object} a First heartbeat.
 * @param {object} b Second heartbeat.
 * @returns {number} Sort order from newest to oldest.
 */
function compareHeartbeatsNewestFirst(a, b) {
    return -compareHeartbeatTime(a, b) || -compareHeartbeatId(a, b);
}

/**
 * @param {object} a First heartbeat.
 * @param {object} b Second heartbeat.
 * @returns {number} Time comparison.
 */
function compareHeartbeatTime(a, b) {
    return String(a.time ?? a.checked_at ?? "").localeCompare(String(b.time ?? b.checked_at ?? ""));
}

/**
 * @param {object} a First heartbeat.
 * @param {object} b Second heartbeat.
 * @returns {number} ID comparison.
 */
function compareHeartbeatId(a, b) {
    return Number(a.id ?? 0) - Number(b.id ?? 0);
}
