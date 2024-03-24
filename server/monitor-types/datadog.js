const { MonitorType } = require("./monitor-type");
const { UP, log, DOWN, PENDING } = require("../../src/util");
const { client, v1 } = require("@datadog/datadog-api-client");

/**
 * A DataDog class extends the MonitorType.
 * It will query DataDog api to get datadog monitor state and sync the monitor status.
 */
class DataDog extends MonitorType {

    name = "datadog";
    /**
     * Run the monitoring check on the given monitor
     * @param {object} monitor - The monitor object associated with the check.
     * @param {object} heartbeat - The heartbeat object to update.
     * @returns {Promise<void>}
     * @throws Will throw an error if the API call found any.
     */
    async check(monitor, heartbeat) {
        try {
            const configurationOpts = {
                authMethods: {
                    apiKeyAuth: monitor.datadog_api_key,
                    appKeyAuth: monitor.datadog_app_key
                },
            };
            const configuration = client.createConfiguration(configurationOpts);
            configuration.setServerVariables({
                site: monitor.datadog_site
            });
            const apiInstance = new v1.MonitorsApi(configuration);
            let params = {
                monitorId: monitor.datadog_monitor_id,
            };
            let status = await apiInstance.getMonitor(params).then((data) => {
                log.debug("datadog", "DataDog API called successfully");
                let state = data["overallState"];
                if (state === "OK") {
                    log.debug("datadog", "UP");
                    return UP;
                } else if (state === "No Data") {
                    log.debug("datadog", "PENDING");
                    return PENDING;
                } else {
                    log.debug("datadog", "DOWN");
                    return DOWN;
                }
            });
            heartbeat.status = status;
        } catch (err) {
            // trigger log function somewhere to display a notification or alert to the user (but how?)
            throw new Error(`Error checking datadog monitor: ${err}`);
        }
    }
}

module.exports = {
    DataDog,
};
