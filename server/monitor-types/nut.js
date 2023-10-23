const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const Nut = require("node-nut");
const { R } = require("redbean-node");

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
        let startTime = dayjs().valueOf();
        let nutValue = "";

        log.debug("NUT", monitor.port, monitor.hostname);
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

                // TODO support multiple named UPS devices
                let upsname = Object.keys(upslist)[0];

                nut.GetUPSVars(upsname, async (vars, err) => {
                    if (err) {
                        log.error("NUT Error:", err);
                    }

                    const status = vars["ups.status"];
                    log.debug("NUT", "status", status);
                    const nutValue = status === monitor.nut_variable;
                    log.debug("NUT", "got value", nutValue);

                    heartbeat.ping = dayjs().valueOf() - startTime;

                    if (monitor.nut_last_result !== nutValue && nutValue !== undefined) {
                        await R.exec("UPDATE `monitor` SET expected_value = ? WHERE id = ? ", [ nutValue, monitor.id ]);
                    }

                    heartbeat.msg = nutValue;
                    heartbeat.status = UP;
                    log.debug("NUT", "Set heartbeat");

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
