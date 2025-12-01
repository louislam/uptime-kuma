const { UP, PENDING, DOWN } = require("../../src/util");
const { MonitorType } = require("./monitor-type");
const Monitor = require("../model/monitor");

class GroupMonitorType extends MonitorType {
    name = "group";
    allowCustomStatus = true;

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
                // Ignore inactive (=paused) children
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
            heartbeat.msg = `Pending child monitors: ${pendingChildren.join(", ")}`;
            return;
        }

        heartbeat.status = DOWN;

        let message = `Child monitors down: ${downChildren.join(", ")}`;

        if (pendingChildren.length > 0) {
            message += `; pending: ${pendingChildren.join(", ")}`;
        }

        // Throw to leverage the generic retry handling and notification flow
        throw new Error(message);
    }
}

module.exports = {
    GroupMonitorType,
};

