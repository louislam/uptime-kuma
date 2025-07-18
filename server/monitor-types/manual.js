const { MonitorType } = require("./monitor-type");
const { UP, DOWN, PENDING } = require("../../src/util");

class ManualMonitorType extends MonitorType {
    name = "Manual";
    type = "manual";
    description = "A monitor that allows manual control of the status";
    supportsConditions = false;
    conditionVariables = [];

    /**
     * @inheritdoc
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
