class MonitorType {
    name = undefined;

    /**
     * Run the monitoring check on the given monitor
     * @param {Monitor} monitor Monitor to check
     * @param {Heartbeat} heartbeat Monitor heartbeat to update
     * @param {UptimeKumaServer} server Uptime Kuma server
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat, server) {
        throw new Error("You need to override check()");
    }
}

module.exports = {
    MonitorType,
};
