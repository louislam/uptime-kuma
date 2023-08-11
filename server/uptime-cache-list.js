const { log } = require("../src/util");
class UptimeCacheList {
    /**
     * list[monitorID][duration]
     */
    static list = {};

    /**
     * Get the uptime for a specific period
     * @param {number} monitorID ID of monitor to query
     * @param {number} duration Duration to query
     * @returns {(number|null)} Uptime for provided duration, if it exists
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
     * @param {number} monitorID ID of monitor to insert for
     * @param {number} duration Duration to insert for
     * @param {number} uptime Uptime to add
     * @returns {void}
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
     * @param {number} monitorID ID of monitor to clear
     * @returns {void}
     */
    static clearCache(monitorID) {
        log.debug("UptimeCacheList", "clearCache: " + monitorID);
        delete UptimeCacheList.list[monitorID];
    }
}

module.exports = {
    UptimeCacheList,
};
