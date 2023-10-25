const jsonata = require("jsonata");
const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const Nut = require("node-nut");

const { log } = require("../../src/util");
log.debug("NUT", "nut file loaded");

class NutMonitorType extends MonitorType {

    /* JOHN_DELETE_NOTE
     * going to do crap job of this then improve
     * hardcoding, not dry, breakable
     */

    name = "nut";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        log.debug("NUT", `MONITOR DATA ${monitor.port} ${monitor.hostname} ${monitor.upsName} ${monitor.jsonPath} ${monitor.expectedValue}`);
        let startTime = dayjs().valueOf();
        let expression = jsonata(monitor.jsonPath);

        const nut = new Nut(monitor.port, monitor.hostname);

        nut.on("error", err => {
            log.error("NUT", "There was an error from the NUT server: " + err);
        });

        nut.on("close", () => {
            log.debug("NUT", "Server connection closed.");
        });
        nut.on("ready", () => {
            log.debug("NUT", "Ready event");
            nut.GetUPSList((upslist, err) => {
                if (err) {
                    log.error("NUT Error: " + err);
                }
                log.debug("NUT", upslist);
                log.debug("NUT😎😎", `we out here ${true}`);

                // TODO support multiple named UPS devices
                let upsname = upslist[monitor.upsName] && monitor.upsName || Object.keys(upslist)[0];
                log.debug("NUT", `ups name ${upsname}`);

                nut.GetUPSVars(upsname, async (vars, err) => {
                    if (err) {
                        log.error("NUT", "Error getting UPS variables", err);
                        return;
                    } else {
                        // convert data to object
                        if (typeof vars === "string") {
                            vars = JSON.parse(vars);
                        }
                        const data = ({ ...vars }); // Why must I do this?
                        // Check device status
                        // Why do I need to do this?!
                        let result = await expression.evaluate(data);
                        log.debug("NUT", `jsonata result ${result}`);

                        if (result.toString() === monitor.expectedValue) {
                            heartbeat.msg = `${monitor.jsonPath} is ${monitor.expectedValue}`;
                            heartbeat.status = UP;
                            heartbeat.ping = dayjs().valueOf() - startTime;
                        } else {
                            throw new Error(heartbeat.msg + ", but value is not equal to expected value, value was: [" + result + "]");
                        }
                    }

                    nut.close();
                });
            });
        });

        nut.start();
    }
}

module.exports = {
    NutMonitorType,
};
