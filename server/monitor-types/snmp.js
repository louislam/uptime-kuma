const { MonitorType } = require("./monitor-type");
const { UP, DOWN, log } = require("../../src/util");
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
            timeout: 1000,
            version: getKey(snmp.Version, monitor.snmpVersion) || snmp.Version2c,
        };

        /**
         * Retrieves the key from the provided object corresponding to the given value.
         * @param {object} obj - The object to search.
         * @param {*} value - The value to search for.
         * @returns {string|null} - The key associated with the value, or null if not found.
         */
        function getKey(obj, value) {
            return Object.keys(obj).find(key => obj[key] === value) || null;
        }

        try {
            const session = snmp.createSession(monitor.hostname, monitor.snmpCommunityString, options);

            // Handle errors during session creation
            session.on("error", (error) => {
                heartbeat.status = DOWN;
                heartbeat.msg = `SNMP: Error creating SNMP session: ${error.message}`;
                log.debug("monitor", heartbeat.msg);
            });

            const varbinds = await new Promise((resolve, reject) => {
                session.get([ monitor.snmpOid ], (error, varbinds) => {
                    if (error) {
                        reject(error);
                    } else {
                        log.debug("monitor", `SNMP: Received varbinds (Type=${getKey(snmp.ObjectType, varbinds[0].type)}): ${varbinds[0].value}`);
                        resolve(varbinds);
                    }
                });
            });

            if (varbinds.length === 0 || getKey(snmp.ObjectType, varbinds[0].type) === "NoSuchInstance") {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);
            } else {
                const value = varbinds[0].value;
                const numericValue = parseInt(value);
                const stringValue = value.toString("ascii");

                switch (monitor.snmpCondition) {
                    case ">":
                        heartbeat.status = numericValue > monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case ">=":
                        heartbeat.status = numericValue >= monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case "<":
                        heartbeat.status = numericValue < monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case "<=":
                        heartbeat.status = numericValue <= monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case "==":
                        if (!isNaN(value) && !isNaN(monitor.snmpControlValue)) {
                            // Both values are numeric, parse them as numbers
                            heartbeat.status = parseFloat(value) === parseFloat(monitor.snmpControlValue) ? UP : DOWN;
                        } else {
                            // At least one of the values is not numeric, compare them as strings
                            heartbeat.status = value.toString() === monitor.snmpControlValue.toString() ? UP : DOWN;
                        }
                        break;
                    case "contains":
                        heartbeat.status = stringValue.includes(monitor.snmpControlValue) ? UP : DOWN;
                        break;
                    default:
                        heartbeat.status = DOWN;
                        heartbeat.msg = `Invalid condition: ${monitor.snmpCondition}`;
                        break;
                }
                heartbeat.msg = "SNMP value " + (heartbeat.status ? "passes" : "does not pass") + ` comparison: ${value.toString("ascii")} ${monitor.snmpCondition} ${monitor.snmpControlValue}`;

            }
            session.close();

        } catch (err) {
            heartbeat.status = DOWN;
            heartbeat.msg = `SNMP Error: ${err.message}`;
            log.debug("monitor", `SNMP: ${heartbeat.msg}`);
        }
    }

}

module.exports = {
    SNMPMonitorType,
};
