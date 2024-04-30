const { MonitorType } = require("./monitor-type");
const { UP, DOWN, log } = require("../../src/util");
const snmp = require("net-snmp");

class SNMPMonitorType extends MonitorType {
    name = "snmp";

    /**
     * Checks the SNMP value against the condition and control value.
     * @param {object} monitor The monitor object associated with the check.
     * @param {object} heartbeat The heartbeat object to update.
     * @param {object} _server Unused server object.
     */
    async check(monitor, heartbeat, _server) {

        log.debug("monitor", `SNMP: Community String: ${monitor.snmpCommunityString}`);
        log.debug("monitor", `SNMP: OID: ${monitor.snmpOid}`);
        log.debug("monitor", `SNMP: Version: ${monitor.snmpVersion}`);
        log.debug("monitor", `SNMP: Condition: ${monitor.snmpCondition}`);
        log.debug("monitor", `SNMP: Control Value: ${monitor.snmpControlValue}`);

        const options = {
            port: monitor.port || '161',
            retries: monitor.maxretries,
            timeout: 1000,
            version: getKey(snmp.Version, monitor.snmpVersion) || snmp.Version2c,
        };

        function getKey(obj, value) {
            return Object.keys(obj).find(key => obj[key] === value) || null;
        }

        try {
            const session = snmp.createSession(monitor.hostname, monitor.snmpCommunityString, options);

            // Handle errors during session creation
            session.on('error', (error) => {
                heartbeat.status = DOWN;
                heartbeat.msg = `SNMP: Error creating SNMP session: ${error.message}`;
                log.debug("monitor", `SNMP: ${heartbeat.msg}`);
            });

            const varbinds = await new Promise((resolve, reject) => {
                session.get([monitor.snmpOid], (error, varbinds) => {
                    if (error) {
                        reject(error);
                    } else {
                        log.debug("monitor", `SNMP: Received varbinds: Type: ${getKey(snmp.ObjectType, varbinds[0].type)}, Value: ${varbinds[0].value}`); // Log the received varbinds for debugging
                        resolve(varbinds);
                    }
                });
            });

            if (varbinds.length === 0 || getKey(snmp.ObjectType, varbinds[0].type) === 'NoSuchInstance') {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);
            } else {
                const value = varbinds[0].value;
                const numericValue = parseInt(value);
                const stringValue = value.toString('ascii');

                switch (monitor.snmpCondition) {
                    case '>':
                        heartbeat.status = numericValue > monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case '>=':
                        heartbeat.status = numericValue >= monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case '<':
                        heartbeat.status = numericValue < monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case '<=':
                        heartbeat.status = numericValue <= monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case '==':
                        if (!isNaN(value) && !isNaN(monitor.snmpControlValue)) {
                            // Both values are numeric, parse them as numbers
                            heartbeat.status = parseFloat(value) === parseFloat(monitor.snmpControlValue) ? UP : DOWN;
                        } else {
                            // At least one of the values is not numeric, compare them as strings
                            heartbeat.status = value.toString() === monitor.snmpControlValue.toString() ? UP : DOWN;
                        }
                        break;
                    case 'contains':
                        heartbeat.status = stringValue.includes(monitor.snmpControlValue) ? UP : DOWN;
                        break;
                    default:
                        heartbeat.status = DOWN;
                        heartbeat.msg = `Invalid condition: ${monitor.snmpCondition}`;
                        break;
                }
                heartbeat.msg = `SNMP value ` + (heartbeat.status ? `passes` : `does not pass`) + ` comparison: ${value.toString('ascii')} ${monitor.snmpCondition} ${monitor.snmpControlValue}`;

            }
            session.close(); // Close the session after use

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