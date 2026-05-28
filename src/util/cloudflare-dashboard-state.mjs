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
 * @param {Function} requestFactory Async request factory.
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
    } catch (_) {
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
    } catch (_) {
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
    } catch (_) {
        // Ignore storage failures during logout.
    }
}

export function getCachedCloudflareChartData(cache, monitorID, period) {
    const entry = cache?.chartData?.[chartCacheKey(monitorID, period)];
    if (!entry || Date.now() - Number(entry.generatedAt) > CHART_CACHE_MAX_AGE_MS) {
        return null;
    }
    return Array.isArray(entry.data) ? entry.data : null;
}

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

function chartCacheKey(monitorID, period) {
    return `${monitorID}:${period}`;
}

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
