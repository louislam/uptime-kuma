const { MonitorType } = require("./monitor-type");

class ManualMonitorType extends MonitorType {
    name = "Manual";
    type = "manual";
    description = "Manual monitoring";
    supportsConditions = false;
    conditionVariables = [];

    /**
     * Checks the status of the monitor manually
     * @param {object} monitor - Monitor object
     * @param {object} heartbeat - Object to write the status of the check
     * @param {object} server - Server object
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat, server) {
        heartbeat.status = monitor.status;
        heartbeat.msg = monitor.msg || "Manual monitoring";
        heartbeat.time = new Date().getTime();
    }
}

module.exports = {
    ManualMonitorType
};
