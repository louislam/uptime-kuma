class MonitorType {

    name = undefined;

    /**
     *
     * @param {Monitor} monitor
     * @param {Heartbeat} heartbeat
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat) {
        throw new Error("You need to override check()");
    }

}

module.exports = {
    MonitorType,
};
