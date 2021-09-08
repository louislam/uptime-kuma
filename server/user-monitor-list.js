class UserMonitorList {

    list = {};

    add(userID, monitor) {
        if (! this.list[userID]) {
            this.list[userID] = {};
        }
        this.list[userID][monitor.id] = monitor;
    }

    delete(userID, monitorID) {
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

module.exports = UserMonitorList;
