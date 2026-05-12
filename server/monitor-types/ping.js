const { MonitorType } = require("./monitor-type");

class PingMonitorType extends MonitorType {
    name = "ping";
}

module.exports = {
    PingMonitorType,
};
