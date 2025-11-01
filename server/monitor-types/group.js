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

        if (children.length === 0) {
            // Set status pending if group is empty
            heartbeat.status = PENDING;
            heartbeat.msg = "Group empty";
            return;
        }

        let worstStatus = UP;
        const downChildren = [];
        const pendingChildren = [];

        for (const child of children) {
            if (!child.active) {
                // Ignore inactive children
                continue;
            }

            const label = child.name || `#${child.id}`;
            const lastBeat = await Monitor.getPreviousHeartbeat(child.id);

            if (!lastBeat) {
                if (worstStatus === UP) {
                    worstStatus = PENDING;
                }
                pendingChildren.push(label);
                continue;
            }

            if (lastBeat.status === DOWN) {
                worstStatus = DOWN;
                downChildren.push(label);
            } else if (lastBeat.status === PENDING) {
                if (worstStatus !== DOWN) {
                    worstStatus = PENDING;
                }
                pendingChildren.push(label);
            }
        }

        if (worstStatus === UP) {
            heartbeat.status = UP;
            heartbeat.msg = "All children up and running";
            return;
        }

        if (worstStatus === PENDING) {
            heartbeat.status = PENDING;
            heartbeat.msg = pendingChildren.length > 0 ? `Pending child monitors: ${pendingChildren.join(", ")}` : "Child monitor pending";
            return;
        }

        heartbeat.status = DOWN;

        const downList = downChildren.join(", ");
        const pendingList = pendingChildren.join(", ");
        let message = downList ? `Child monitors down: ${downList}` : "Child monitor down";

        if (pendingChildren.length > 0) {
            message += `; pending: ${pendingList}`;
        }

        // Throw to leverage the generic retry handling and notification flow
        throw new Error(message);
    }
}

module.exports = {
    GroupMonitorType,
};

