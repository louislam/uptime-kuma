const { log } = require("../src/util");
class UptimeCacheList {
    /**
     * list[monitorID][duration]
     */
    static list = {};

    /**
     *
     * @param monitorID
     * @param duration
     * @return number
     */
    static getUptime(monitorID, duration) {
        if (UptimeCacheList.list[monitorID] && UptimeCacheList.list[monitorID][duration]) {
            log.debug("UptimeCacheList", "getUptime: " + monitorID + " " + duration);
            return UptimeCacheList.list[monitorID][duration];
        } else {
            return null;
        }
    }

    static addUptime(monitorID, duration, uptime) {
        log.debug("UptimeCacheList", "addUptime: " + monitorID + " " + duration);
        if (!UptimeCacheList.list[monitorID]) {
            UptimeCacheList.list[monitorID] = {};
        }
        UptimeCacheList.list[monitorID][duration] = uptime;
    }

    static clearCache(monitorID) {
        log.debug("UptimeCacheList", "clearCache: " + monitorID);
        delete UptimeCacheList.list[monitorID];
    }
}

module.exports = {
    UptimeCacheList,
};
