const { MonitorType } = require("./monitor-type");
const { UP, DOWN, log, getKey } = require("../../src/util");
const snmp = require("net-snmp");

class SNMPMonitorType extends MonitorType {
    name = "snmp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {

        const options = {
            port: monitor.port || "161",
            retries: monitor.maxretries,
            timeout: monitor.timeout * 1000,
            version: monitor.snmpVersion,
        };

        try {
            const session = snmp.createSession(monitor.hostname, monitor.snmpCommunityString, options);

            // Handle errors during session creation
            session.on("error", (error) => {
                throw new Error(`Error creating SNMP session: ${error.message}`);
            });

            const varbinds = await new Promise((resolve, reject) => {
                session.get([ monitor.snmpOid ], (error, varbinds) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(varbinds);
                    }
                });
            });
            log.debug("monitor", `SNMP: Received varbinds (Type=${getKey(snmp.ObjectType, varbinds[0].type)}): ${varbinds[0].value}`);

            // Verify if any varbinds were returned from the SNMP session or if the varbind type indicates a non-existent instance.
            if (varbinds.length === 0 || varbinds[0].type === snmp.ObjectType.NoSuchInstance) {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);

            }

            // We restrict querying to one OID per monitor, therefore `varbinds[0]` will always contain the value we're interested in.
            const value = varbinds[0].value;

            // Check if inputs are numeric. If not, re-parse as strings. This ensures comparisons are handled correctly.
            let snmpValue = isNaN(value) ? value.toString() : parseFloat(value);
            let snmpControlValue = isNaN(monitor.snmpControlValue) ? monitor.snmpControlValue.toString() : parseFloat(monitor.snmpControlValue);

            switch (monitor.snmpCondition) {
                case ">":
                    heartbeat.status = snmpValue > snmpControlValue ? UP : DOWN;
                    break;
                case ">=":
                    heartbeat.status = snmpValue >= snmpControlValue ? UP : DOWN;
                    break;
                case "<":
                    heartbeat.status = snmpValue < snmpControlValue ? UP : DOWN;
                    break;
                case "<=":
                    heartbeat.status = snmpValue <= snmpControlValue ? UP : DOWN;
                    break;
                case "==":
                    heartbeat.status = snmpValue.toString() === snmpControlValue.toString() ? UP : DOWN;
                    break;
                case "contains":
                    heartbeat.status = snmpValue.toString().includes(snmpControlValue.toString()) ? UP : DOWN;
                    break;
                default:
                    throw new Error(`Invalid condition ${monitor.snmpCondition}`);
            }
            heartbeat.msg = "SNMP value " + (heartbeat.status ? "passes" : "does not pass") + ` comparison: ${value.toString()} ${monitor.snmpCondition} ${snmpControlValue}`;

            session.close();

        } catch (err) {
            if (err instanceof snmp.RequestTimedOutError) {
                heartbeat.status = DOWN;
                heartbeat.msg = `SNMP Error: Timed out after ${monitor.timeout} seconds`;
            } else {
                heartbeat.status = DOWN;
                heartbeat.msg = `SNMP Error: ${err.message}`;
            }
        }
    }

}

module.exports = {
    SNMPMonitorType,
};
