/**
 * Main monitor list
 */
class UserMonitorList {
    list = {};

    /**
     * Add or update
     * @param userID
     * @param monitor
     */
    add(userID, monitor) {
        if (! this.list[userID]) {
            this.list[userID] = {};
        }

        // Stopped the old monitor if same id
        this.stop(userID, monitor.id);

        this.list[userID][monitor.id] = monitor;
    }

    stop(userID, monitorID) {
        if (this.list[userID][monitorID]) {
            let oldMonitor = this.list[userID][monitorID];

            if (oldMonitor) {
                oldMonitor.stop();
            } else {
                console.log("No old monitor: " + monitorID);
            }
        }
    }

    delete(userID, monitorID) {
        this.stop(userID, monitorID);
        let monitorList = this.getMonitorList(userID);
        delete monitorList[monitorID];
    }

    getMonitor(userID, monitorID) {
        let monitorList = this.getMonitorList(userID);

        if (monitorList[monitorID]) {
            return monitorList[monitorID];
        } else {
            return {};
        }
    }

    getMonitorList(userID) {
        if (this.list[userID]) {
            return this.list[userID];
        } else {
            return {};
        }
    }

    getAllMonitorList() {
        let list = {};
        for (let userID in this.list) {
            let monitorList = this.list[userID];

            for (let monitorID in monitorList) {
                list[monitorID] = monitorList[monitorID];
            }
        }
        return list;
    }

}

module.exports = {
    userMonitorList: new UserMonitorList(),
};
