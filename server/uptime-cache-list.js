const { log } = require("../src/util");
class UptimeCacheList {
    /**
     * list[monitorID][duration]
     */
    static list = {};

    /**
     * Get the uptime for a specific period
     * @param {number} monitorID
     * @param {number} duration
     * @return {number}
     */
    static getUptime(monitorID, duration) {
        if (UptimeCacheList.list[monitorID] && UptimeCacheList.list[monitorID][duration]) {
            log.debug("UptimeCacheList", "getUptime: " + monitorID + " " + duration);
            return UptimeCacheList.list[monitorID][duration];
        } else {
            return null;
        }
    }

    /**
     * Add uptime for specified monitor
     * @param {number} monitorID
     * @param {number} duration
     * @param {number} uptime Uptime to add
     */
    static addUptime(monitorID, duration, uptime) {
        log.debug("UptimeCacheList", "addUptime: " + monitorID + " " + duration);
        if (!UptimeCacheList.list[monitorID]) {
            UptimeCacheList.list[monitorID] = {};
        }
        UptimeCacheList.list[monitorID][duration] = uptime;
    }

    /**
     * Clear cache for specified monitor
     * @param {number} monitorID
     */
    static clearCache(monitorID) {
        log.debug("UptimeCacheList", "clearCache: " + monitorID);
        delete UptimeCacheList.list[monitorID];
    }
}

module.exports = {
    UptimeCacheList,
};
