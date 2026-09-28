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
     * Allows setting any custom status to heartbeat, other than UP.
     * @type {boolean}
     */
    allowCustomStatus = false;

    /**
     * Run the monitoring check on the given monitor
     *
     * Successful cases: Should update heartbeat.status to "up" and set response time.
     * Failure cases: Throw an error with a descriptive message.
     * @param {Monitor} monitor Monitor to check
     * @param {Heartbeat} heartbeat Monitor heartbeat to update
     * @param {UptimeKumaServer} server Uptime Kuma server
     * @returns {Promise<void>}
     */
    async check(monitor, heartbeat, server) {
        throw new Error("You need to override check()");
    }

    /**
     * Release any resource this type holds for the given monitor.
     *
     * Called when the monitor stops (pause, edit, delete, shutdown) and when it
     * enters effective maintenance. Types that connect only for the duration of
     * a check hold nothing and inherit this no-op; types that keep a persistent
     * connection must close sockets and cancel timers here.
     * @param {Monitor} monitor Monitor being released
     * @param {UptimeKumaServer} server Uptime Kuma server
     * @returns {Promise<void>}
     */
    async dispose(monitor, server) {}
}

module.exports = {
    MonitorType,
};
