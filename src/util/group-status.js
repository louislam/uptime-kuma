const DOWN = 0;
const UP = 1;
const PENDING = 2;
const MAINTENANCE = 3;

const UNKNOWN = -1;

/**
 * Return active non-group descendants for a group monitor.
 * @param {object} groupMonitor Group monitor
 * @param {object} monitorList Monitor map
 * @returns {object[]} Active child monitors
 */
function getGroupChildMonitors(groupMonitor, monitorList) {
    if (!groupMonitor || !monitorList) {
        return [];
    }

    const children = Object.values(monitorList).filter((monitor) => monitor.parent === groupMonitor.id);
    let result = [];

    for (const child of children) {
        if (!isActive(child)) {
            continue;
        }

        if (child.type === "group") {
            result = result.concat(getGroupChildMonitors(child, monitorList));
        } else {
            result.push(child);
        }
    }

    return result;
}

/**
 * Get the latest heartbeat for a monitor.
 * @param {object} heartbeatList Map of monitor heartbeat arrays
 * @param {number} monitorId Monitor id
 * @returns {object|null} Latest heartbeat
 */
function getLatestHeartbeat(heartbeatList, monitorId) {
    const heartbeats = heartbeatList?.[monitorId];

    if (!Array.isArray(heartbeats) || heartbeats.length === 0) {
        return null;
    }

    return heartbeats[heartbeats.length - 1] || null;
}

/**
 * Calculate aggregate status from child monitors.
 * @param {object[]} monitors Child monitors
 * @param {object} heartbeatList Map of monitor heartbeat arrays
 * @returns {number} Aggregate status
 */
function calculateGroupStatus(monitors, heartbeatList) {
    const activeMonitors = monitors.filter(isActive);

    if (activeMonitors.length === 0) {
        return UNKNOWN;
    }

    let hasHeartbeat = false;
    let hasPending = false;

    for (const monitor of activeMonitors) {
        const heartbeat = getLatestHeartbeat(heartbeatList, monitor.id);

        if (!heartbeat || heartbeat.status === undefined || heartbeat.status === null) {
            hasPending = true;
            continue;
        }

        hasHeartbeat = true;
        const status = Number(heartbeat.status);

        if (status === MAINTENANCE) {
            return MAINTENANCE;
        }

        if (status === DOWN) {
            return DOWN;
        }

        if (status === PENDING) {
            hasPending = true;
        }
    }

    if (!hasHeartbeat) {
        return UNKNOWN;
    }

    return hasPending ? PENDING : UP;
}

/**
 * Convert a status code into the badge display used by monitor details.
 * @param {number} status Status code
 * @param {Function} translate Translation function
 * @returns {{text: string, color: string}} Badge display state
 */
function statusToBadge(status, translate) {
    const t = typeof translate === "function" ? translate : (key) => key;

    if (status === UP) {
        return {
            text: t("Up"),
            color: "primary",
        };
    }

    if (status === DOWN) {
        return {
            text: t("Down"),
            color: "danger",
        };
    }

    if (status === PENDING) {
        return {
            text: t("Pending"),
            color: "warning",
        };
    }

    if (status === MAINTENANCE) {
        return {
            text: t("statusMaintenance"),
            color: "maintenance",
        };
    }

    return {
        text: t("Unknown"),
        color: "secondary",
    };
}

/**
 * Calculate the dashboard detail badge state for a group monitor.
 * @param {object} groupMonitor Group monitor
 * @param {object} monitorList Monitor map
 * @param {object} heartbeatList Map of monitor heartbeat arrays
 * @param {Function} translate Translation function
 * @returns {{text: string, color: string}|null} Badge display state
 */
function calculateGroupStatusBadge(groupMonitor, monitorList, heartbeatList, translate) {
    if (groupMonitor?.type !== "group") {
        return null;
    }

    const childMonitors = getGroupChildMonitors(groupMonitor, monitorList);

    if (childMonitors.length === 0) {
        return null;
    }

    return statusToBadge(calculateGroupStatus(childMonitors, heartbeatList), translate);
}

/**
 * Calculate an aggregate uptime ratio from child monitor uptime values.
 * @param {object[]} monitors Child monitors
 * @param {object} uptimeList Map of uptime ratios
 * @param {string} type Uptime window type
 * @returns {number|null} Aggregate uptime ratio
 */
function calculateGroupUptime(monitors, uptimeList, type = "24") {
    const activeMonitors = monitors.filter(isActive);

    if (activeMonitors.length === 0) {
        return null;
    }

    let total = 0;

    for (const monitor of activeMonitors) {
        const uptime = uptimeList?.[`${monitor.id}_${type}`];

        if (typeof uptime !== "number" || Number.isNaN(uptime)) {
            return null;
        }

        total += uptime;
    }

    return total / activeMonitors.length;
}

/**
 * Build a synthetic heartbeat list by aggregating child heartbeat slots.
 * @param {object[]} monitors Child monitors
 * @param {object} heartbeatList Map of monitor heartbeat arrays
 * @returns {Array} Synthetic heartbeat list
 */
function buildGroupHeartbeatList(monitors, heartbeatList) {
    const activeMonitors = monitors.filter(isActive);

    if (activeMonitors.length === 0) {
        return [];
    }

    const childLists = activeMonitors.map((monitor) => heartbeatList?.[monitor.id]).filter(Array.isArray);
    const maxLength = Math.max(0, ...childLists.map((list) => list.length));

    if (maxLength === 0) {
        return [];
    }

    const result = [];

    for (let index = 0; index < maxLength; index++) {
        const offsetFromEnd = maxLength - index;
        const beats = activeMonitors.map((monitor) => {
            const list = heartbeatList?.[monitor.id];
            return Array.isArray(list) ? list[list.length - offsetFromEnd] : null;
        });
        const usableBeats = beats.filter((beat) => beat && beat.status !== undefined && beat.status !== null);

        if (usableBeats.length === 0) {
            result.push(0);
            continue;
        }

        const aggregateStatus = calculateBeatStatus(beats);
        const latestBeat = usableBeats.reduce((latest, beat) => {
            if (!latest || new Date(beat.time) > new Date(latest.time)) {
                return beat;
            }
            return latest;
        }, null);

        result.push({
            status: aggregateStatus,
            time: latestBeat?.time,
            msg: "Group status",
        });
    }

    return result;
}

/**
 * Calculate aggregate status for a single heartbeat slot.
 * @param {Array} beats Child heartbeat slot values
 * @returns {number} Aggregate status
 */
function calculateBeatStatus(beats) {
    let hasHeartbeat = false;
    let hasPending = false;

    for (const beat of beats) {
        if (!beat || beat.status === undefined || beat.status === null) {
            hasPending = true;
            continue;
        }

        hasHeartbeat = true;
        const status = Number(beat.status);

        if (status === MAINTENANCE) {
            return MAINTENANCE;
        }

        if (status === DOWN) {
            return DOWN;
        }

        if (status === PENDING) {
            hasPending = true;
        }
    }

    if (!hasHeartbeat) {
        return UNKNOWN;
    }

    return hasPending ? PENDING : UP;
}

/**
 * Is a monitor active for aggregate status.
 * @param {object} monitor Monitor
 * @returns {boolean} Whether the monitor should count
 */
function isActive(monitor) {
    return monitor?.active !== false && monitor?.active !== 0;
}

module.exports = {
    UNKNOWN,
    buildGroupHeartbeatList,
    calculateGroupStatusBadge,
    calculateGroupStatus,
    calculateGroupUptime,
    getGroupChildMonitors,
    statusToBadge,
};
