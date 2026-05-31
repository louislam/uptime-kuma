const SECONDARY_CACHE_KEY = "uptimeworker.cloudflare.dashboard.secondary.v1";
const SECONDARY_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const CHART_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const inFlightRequests = new Map();

/**
 * Build lookup indexes used by the monitor tree and group views.
 * @param {object} monitorList Monitor map keyed by ID.
 * @returns {object} Dashboard monitor indexes.
 */
export function buildMonitorIndexes(monitorList = {}) {
    const childrenByParentId = {};
    const rootMonitorIds = [];
    const activeLeafIdsByGroupId = {};
    const monitors = Object.values(monitorList);

    for (const monitor of monitors) {
        const parentKey = monitor.parent == null ? "root" : String(monitor.parent);
        if (!childrenByParentId[parentKey]) {
            childrenByParentId[parentKey] = [];
        }
        childrenByParentId[parentKey].push(Number(monitor.id));
    }

    for (const ids of Object.values(childrenByParentId)) {
        ids.sort((a, b) => compareMonitors(monitorList[a], monitorList[b]));
    }
    rootMonitorIds.push(...(childrenByParentId.root || []));

    for (const monitor of monitors) {
        if (monitor.type === "group") {
            activeLeafIdsByGroupId[monitor.id] = collectActiveLeafIds(monitor, monitorList, childrenByParentId);
        }
    }

    return {
        childrenByParentId,
        rootMonitorIds,
        activeLeafIdsByGroupId,
    };
}

/**
 * Deduplicate concurrent Worker dashboard requests.
 * @param {string} key Request cache key.
 * @param {() => Promise<unknown>} requestFactory Async request factory.
 * @returns {Promise<unknown>} Request result.
 */
export function dedupeCloudflareDashboardRequest(key, requestFactory) {
    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key);
    }
    const request = Promise.resolve()
        .then(requestFactory)
        .finally(() => {
            inFlightRequests.delete(key);
        });
    inFlightRequests.set(key, request);
    return request;
}

/**
 * Read cached secondary dashboard data.
 * @returns {object} Cached secondary data.
 */
export function readCloudflareDashboardSecondaryCache() {
    try {
        const raw = globalThis.localStorage?.getItem(SECONDARY_CACHE_KEY);
        if (!raw) {
            return {};
        }
        const cached = JSON.parse(raw);
        if (!cached || Date.now() - Number(cached.generatedAt) > SECONDARY_CACHE_MAX_AGE_MS) {
            return {};
        }
        return cached.state || {};
    } catch {
        return {};
    }
}

/**
 * Persist cached secondary dashboard data.
 * @param {object} state Secondary state.
 * @returns {void}
 */
export function writeCloudflareDashboardSecondaryCache(state = {}) {
    try {
        globalThis.localStorage?.setItem(
            SECONDARY_CACHE_KEY,
            JSON.stringify({
                generatedAt: Date.now(),
                state,
            })
        );
    } catch {
        // Storage can be full or unavailable; live API reads still work.
    }
}

/**
 * Clear cached secondary dashboard data.
 * @returns {void}
 */
export function clearCloudflareDashboardSecondaryCache() {
    try {
        globalThis.localStorage?.removeItem(SECONDARY_CACHE_KEY);
    } catch {
        // Ignore storage failures during logout.
    }
}

/**
 * Read cached chart datapoints for a monitor and period.
 * @param {object} cache Secondary dashboard cache.
 * @param {number|string} monitorID Monitor ID.
 * @param {number|string} period Chart period in hours.
 * @returns {object[]|null} Cached chart datapoints, or null when unavailable.
 */
export function getCachedCloudflareChartData(cache, monitorID, period) {
    const entry = cache?.chartData?.[chartCacheKey(monitorID, period)];
    if (!entry || Date.now() - Number(entry.generatedAt) > CHART_CACHE_MAX_AGE_MS) {
        return null;
    }
    return Array.isArray(entry.data) ? entry.data : null;
}

/**
 * Persist chart datapoints in the secondary dashboard cache.
 * @param {object} cache Secondary dashboard cache.
 * @param {number|string} monitorID Monitor ID.
 * @param {number|string} period Chart period in hours.
 * @param {object[]} data Chart datapoints.
 * @returns {object} Updated secondary dashboard cache.
 */
export function setCachedCloudflareChartData(cache, monitorID, period, data) {
    const nextCache = {
        ...(cache || {}),
        chartData: {
            ...((cache && cache.chartData) || {}),
            [chartCacheKey(monitorID, period)]: {
                generatedAt: Date.now(),
                data,
            },
        },
    };
    writeCloudflareDashboardSecondaryCache(nextCache);
    return nextCache;
}

/**
 * Reuse unchanged dashboard records so background refreshes do not force Vue
 * components, canvases, or charts to redraw when the visible data is identical.
 * @param {object} previous Previous dashboard state.
 * @param {object} next Incoming dashboard state.
 * @returns {object} Dashboard state with unchanged references preserved.
 */
export function reuseUnchangedDashboardState(previous = {}, next = {}) {
    return {
        ...next,
        monitorList: reuseUnchangedRecord(previous.monitorList, next.monitorList),
        heartbeatList: reuseUnchangedRecord(previous.heartbeatList, next.heartbeatList),
        avgPingList: reuseUnchangedRecord(previous.avgPingList, next.avgPingList),
        uptimeList: reuseUnchangedRecord(previous.uptimeList, next.uptimeList),
    };
}

/**
 * Build the chart cache key for a monitor and period.
 * @param {number|string} monitorID Monitor ID.
 * @param {number|string} period Chart period in hours.
 * @returns {string} Cache key.
 */
function chartCacheKey(monitorID, period) {
    return `${monitorID}:${period}`;
}

/**
 * Reuse unchanged values in a keyed dashboard record.
 * @param {object} previousRecord Previous keyed record.
 * @param {object} nextRecord Incoming keyed record.
 * @returns {object} Merged keyed record.
 */
function reuseUnchangedRecord(previousRecord, nextRecord) {
    if (!isPlainObject(previousRecord) || !isPlainObject(nextRecord)) {
        return nextRecord;
    }

    let changed = false;
    const merged = {};
    const previousKeys = Object.keys(previousRecord);
    const nextKeys = Object.keys(nextRecord);

    if (previousKeys.length !== nextKeys.length) {
        changed = true;
    }

    for (const key of nextKeys) {
        if (Object.prototype.hasOwnProperty.call(previousRecord, key)
            && serializableDeepEqual(previousRecord[key], nextRecord[key])) {
            merged[key] = previousRecord[key];
        } else {
            merged[key] = nextRecord[key];
            changed = true;
        }
    }

    return changed ? merged : previousRecord;
}

/**
 * Deep-compare serializable values while ignoring functions.
 * @param {unknown} left First value.
 * @param {unknown} right Second value.
 * @returns {boolean} True when values are serializably equal.
 */
function serializableDeepEqual(left, right) {
    if (Object.is(left, right)) {
        return true;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }

        return left.every((item, index) => serializableDeepEqual(item, right[index]));
    }

    if (isPlainObject(left) || isPlainObject(right)) {
        if (!isPlainObject(left) || !isPlainObject(right)) {
            return false;
        }

        const leftKeys = serializableKeys(left);
        const rightKeys = serializableKeys(right);
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }

        return leftKeys.every((key, index) => (
            key === rightKeys[index]
            && serializableDeepEqual(left[key], right[key])
        ));
    }

    return false;
}

/**
 * Get sorted keys that affect serialized dashboard equality.
 * @param {object} value Object to inspect.
 * @returns {string[]} Serializable keys.
 */
function serializableKeys(value) {
    return Object.keys(value)
        .filter((key) => typeof value[key] !== "function" && value[key] !== undefined)
        .sort();
}

/**
 * Check for non-array objects.
 * @param {unknown} value Value to inspect.
 * @returns {boolean} True when value is a plain object for this module's purposes.
 */
function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Collect active leaf monitor IDs within a group.
 * @param {object} groupMonitor Group monitor.
 * @param {object} monitorList Monitor map keyed by ID.
 * @param {object} childrenByParentId Child monitor IDs by parent ID.
 * @returns {number[]} Active leaf monitor IDs.
 */
function collectActiveLeafIds(groupMonitor, monitorList, childrenByParentId) {
    const result = [];
    for (const childId of childrenByParentId[String(groupMonitor.id)] || []) {
        const child = monitorList[childId];
        if (!child || child.active === false || child.active === 0) {
            continue;
        }
        if (child.type === "group") {
            result.push(...collectActiveLeafIds(child, monitorList, childrenByParentId));
        } else {
            result.push(Number(child.id));
        }
    }
    return result;
}

/**
 * Sort monitors by active state, weight, then name.
 * @param {object} a First monitor.
 * @param {object} b Second monitor.
 * @returns {number} Sort order.
 */
function compareMonitors(a, b) {
    if (!a || !b) {
        return 0;
    }
    const aActive = a.active === undefined ? true : Boolean(a.active);
    const bActive = b.active === undefined ? true : Boolean(b.active);
    if (aActive !== bActive) {
        return aActive ? -1 : 1;
    }
    if (a.weight !== b.weight) {
        return a.weight > b.weight ? -1 : 1;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
}
