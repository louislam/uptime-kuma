class MonitorType {

    name = undefined;

    /**
     *
     * @param {Monitor} monitor
     * @param {Heartbeat} heartbeat
     * @param {UptimeKumaServer} server
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat, server) {
        throw new Error("You need to override check()");
    }

}

module.exports = {
    MonitorType,
};
