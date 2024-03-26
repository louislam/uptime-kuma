const { MonitorType } = require("./monitor-type");
const { UP,log, DOWN } = require("../../src/util");

/**
 * A AtlassianStatusPage class extends the MonitorType.
 * It will check Status page API and monitor specific component.
 */
class Atlassian extends MonitorType {

    name = "atlassian";

    /**
     * Checks the ping status of the URL associated with the monitor.
     * It then parses the Tailscale ping command output to update the heatrbeat.
     * @param {object} monitor The monitor object associated with the check.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>}
     * @throws Error if checking Tailscale ping encounters any error
     */
    async check(monitor, heartbeat) {
        try {
            log.info("AtlassianStatus",monitor.url);
            log.info("AtlassianStatus",monitor.component_name);
            const response = (await fetch(monitor.url));
            const body = await response.json();
            // log.debug("AtlassianStatus",body["components"]);
            let component_status = new Map();
            for (let index = 0; index < body["components"].length; index++) {
                const element = body["components"][index];
                component_status.set(element["name"],element["status"])
            }
            log.debug("AtlassianStatus",component_status);
            if (component_status.get(monitor.component_name)!= undefined ) {
                if (component_status.get(monitor.component_name) === "operational") {
                    log.debug("AtlassianStatus",component_status.get(monitor.component_name))
                    heartbeat.status = UP
                }else {
                    heartbeat.status = DOWN
                }
            } else {
                throw new Error("Component not exist into the status");
            }
            
        } catch (err) {
            // trigger log function somewhere to display a notification or alert to the user (but how?)
            throw new Error(`StatusPage check errors: ${err}`);
        }
    }
}

module.exports = {
    Atlassian,
};
