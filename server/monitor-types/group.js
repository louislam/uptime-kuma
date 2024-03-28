const { UP, PENDING, DOWN } = require("../../src/util");
const { MonitorType } = require("./monitor-type");
const Monitor = require("../model/monitor");

class GroupMonitorType extends MonitorType {
    name = "group";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const children = await Monitor.getChildren(monitor.id);

        if (children.length > 0) {
            heartbeat.status = UP;
            heartbeat.msg = "All children up and running";
            for (const child of children) {
                if (!child.active) {
                    // Ignore inactive childs
                    continue;
                }
                const lastBeat = await Monitor.getPreviousHeartbeat(child.id);

                // Only change state if the monitor is in worse conditions then the ones before
                // lastBeat.status could be null
                if (!lastBeat) {
                    heartbeat.status = PENDING;
                } else if (heartbeat.status === UP && (lastBeat.status === PENDING || lastBeat.status === DOWN)) {
                    heartbeat.status = lastBeat.status;
                } else if (heartbeat.status === PENDING && lastBeat.status === DOWN) {
                    heartbeat.status = lastBeat.status;
                }
            }

            if (heartbeat.status !== UP) {
                heartbeat.msg = "Child inaccessible";
            }
        } else {
            // Set status pending if group is empty
            heartbeat.status = PENDING;
            heartbeat.msg = "Group empty";
        }
    }
}

module.exports = {
    GroupMonitorType,
};

