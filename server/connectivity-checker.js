const { R } = require("redbean-node");
const { log } = require("../src/util");
const { UP, DOWN, PENDING } = require("../src/util");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const { ping } = require("./util-server");
const axios = require("axios");

const CACHE_TTL_MS = 30_000;

class ConnectivityChecker {
    static cache = new Map();

    /**
     * Check if all validation monitors for a given monitor are UP.
     * Returns true if no validators configured or all are UP.
     * @param {object} monitor The monitor object
     * @returns {Promise<boolean>} true if internet is available
     */
    static async isInternetAvailable(monitor) {
        if (!monitor?.connectivity_check_monitors) {
            return true;
        }

        let monitorIds;
        try {
            monitorIds = JSON.parse(monitor.connectivity_check_monitors);
        } catch {
            return true;
        }
        if (!Array.isArray(monitorIds) || monitorIds.length === 0) {
            return true;
        }

        for (const id of monitorIds) {
            const isUp = await ConnectivityChecker.recheckMonitor(id);
            if (!isUp) {
                return false;
            }
        }
        return true;
    }

    /**
     * Recheck a monitor in real-time to verify connectivity.
     * Results are cached for CACHE_TTL_MS to avoid redundant checks.
     * @param {number} monitorId The monitor ID to recheck
     * @returns {Promise<boolean>} true if the monitor is UP
     */
    static async recheckMonitor(monitorId) {
        const cacheKey = `validation:${monitorId}`;
        const cached = ConnectivityChecker.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.result;
        }

        const monitorData = await R.findOne("monitor", " id = ?", [monitorId]);
        if (!monitorData || !monitorData.active) {
            return true;
        }

        let isUp = false;
        try {
            if (monitorData.type === "ping") {
                await ping(monitorData.hostname, 1, "", true, 56, 3, 3);
                isUp = true;
            } else if (["http", "keyword", "json-query"].includes(monitorData.type)) {
                await axios.get(monitorData.url, {
                    timeout: 5000,
                    maxRedirects: 5,
                    validateStatus: () => true,
                });
                isUp = true;
            } else if (monitorData.type in UptimeKumaServer.monitorTypeList) {
                const monitorType = UptimeKumaServer.monitorTypeList[monitorData.type];
                const tempBean = R.dispense("heartbeat");
                tempBean.status = DOWN;
                await monitorType.check(monitorData, tempBean, UptimeKumaServer.getInstance());
                isUp = tempBean.status === UP;
            } else {
                // Fallback: last heartbeat
                const Monitor = require("./model/monitor");
                const lastBeat = await Monitor.getPreviousHeartbeat(monitorId);
                isUp = lastBeat && lastBeat.status !== DOWN && lastBeat.status !== PENDING;
            }
        } catch {
            isUp = false;
        }

        ConnectivityChecker.cache.set(cacheKey, { result: isUp, timestamp: Date.now() });
        log.debug("connectivity", `Recheck monitor ${monitorId} (${monitorData.name}): ${isUp ? "UP" : "DOWN"}`);
        return isUp;
    }
}

module.exports = {
    ConnectivityChecker,
};
