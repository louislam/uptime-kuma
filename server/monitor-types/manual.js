const { MonitorType } = require("./monitor-type");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");

class ManualMonitorType extends MonitorType {
    name = "Manual";
    type = "manual";
    description = "A monitor that allows manual control of the status";
    supportsConditions = false;
    conditionVariables = [];

    /**
     * Checks the status of the monitor based on the manually set status
     * This monitor type is specifically designed for status pages where manual control is needed
     * @param {object} monitor - Monitor object containing the current status and message
     * @param {object} heartbeat - Object to write the status of the check
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat) {
        if (monitor.manual_status !== null) {
            heartbeat.status = monitor.manual_status;
            switch (monitor.manual_status) {
                case UP:
                    heartbeat.msg = "Up";
                    break;
                case DOWN:
                    heartbeat.msg = "Down"; 
                    break;
                case MAINTENANCE:
                    heartbeat.msg = "Maintenance";
                    break;
                default:
                    heartbeat.msg = "Pending";
            }
        } else {
            heartbeat.status = PENDING;
            heartbeat.msg = "Manual monitoring - No status set";
        }
    }
}

module.exports = {
    ManualMonitorType
};
