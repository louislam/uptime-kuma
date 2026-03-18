const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { getPM2ProcessList } = require("../util/pm2");

class PM2MonitorType extends MonitorType {
    name = "pm2";
    description = "Checks if a PM2 process is online.";

    /**
     * List PM2 processes. Exposed as a method so tests can stub it directly.
     * @returns {Promise<{id: string, name: string, status: string}[]>} The normalized PM2 process list.
     */
    async getProcessList() {
        return getPM2ProcessList();
    }

    /**
     * Check the PM2 process status.
     * @param {object} monitor The monitor object containing monitor.system_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat) {
        let processName = (monitor.system_service_name || "").trim();
        if (processName.toLowerCase().startsWith("pm2:")) {
            processName = processName.slice(4).trim();
        }

        if (!processName) {
            throw new Error("PM2 process name is required.");
        }

        if (/[\u0000-\u001F\u007F]/.test(processName)) {
            throw new Error("Invalid PM2 process name.");
        }

        const processList = await this.getProcessList();
        const entry = processList.find((item) => item.name === processName || item.id === processName);

        if (!entry) {
            throw new Error(`PM2 process '${processName}' was not found.`);
        }

        if (entry.status === "online") {
            heartbeat.status = UP;
            heartbeat.msg = `PM2 process '${processName}' is online.`;
            return;
        }

        throw new Error(`PM2 process '${processName}' is ${entry.status}.`);
    }
}

module.exports = {
    PM2MonitorType,
};
