const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { getPM2ProcessList } = require("../util/pm2");

class PM2MonitorType extends MonitorType {
    name = "pm2";
    description = "Checks if a PM2 process is online.";

    /**
     * Check the PM2 process status.
     * @param {object} monitor The monitor object containing monitor.system_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat) {
        const processName = (monitor.system_service_name || "").trim();
        const processList = await getPM2ProcessList();
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
