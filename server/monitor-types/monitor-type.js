class MonitorType {
    name = undefined;

    /**
     * Whether or not this type supports monitor conditions. Controls UI visibility in monitor form.
     * @type {boolean}
     */
    supportsConditions = false;

    /**
     * Variables supported by this type. e.g. an HTTP type could have a "response_code" variable to test against.
     * This property controls the choices displayed in the monitor edit form.
     * @type {import("../monitor-conditions/variables").ConditionVariable[]}
     */
    conditionVariables = [];

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
