const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");

class TailscalePing extends MonitorType {

    name = "tailscale-ping";

    async check(monitor, heartbeat) {
        // TODO: Logic here

        // Successful:
        // heartbeat.status = UP;
        // heartbeat.ping = timing.responseEnd;
        // heartbeat.msg = "????"

        // Failed:
        // throw new Error("????");

        throw new Error("Not implemented");
    }
}

module.exports = {
    TailscalePing,
};
