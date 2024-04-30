const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
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

        console.log("IP Address:", monitor._hostname);
        console.log("SNMP Community String:", monitor._snmpCommunityString);
        console.log("SNMP OID:", monitor._snmpOid);
        console.log("SNMP Version:", monitor._snmpVersion);
        console.log("SNMP Condition:", monitor._snmpCondition);
        console.log("SNMP Control Value:", monitor._snmpControlValue);

        const options = {
            port: monitor._port || 161,
            retries: 1,
            timeout: 1000,
            version: getKey(snmp.Version, monitor._snmpVersion) || snmp.Version2c,
        };

        function getKey(obj, value) {
            return Object.keys(obj).find(key => obj[key] === value) || null;
        }

        try {
            const session = snmp.createSession(monitor.hostname, monitor.snmpCommunityString, options);

            const varbinds = await new Promise((resolve, reject) => {
                session.get([monitor._snmpOid], (error, varbinds) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(varbinds);
                    }
                });
            });

            console.log("Received varbinds:", varbinds); // Log the received varbinds for debugging

            if (varbinds && varbinds.length > 0) {
                const value = varbinds[0].value;
                const numericValue = parseInt(value);
                const stringValue = value.toString();

                switch (monitor.snmpCondition) {
                    case '>':
                        heartbeat.status = numericValue > monitor._snmpControlValue ? UP : DOWN;
                        break;
                    case '>=':
                        heartbeat.status = numericValue >= monitor._snmpControlValue ? UP : DOWN;
                        break;
                    case '<':
                        heartbeat.status = numericValue < monitor._snmpControlValue ? UP : DOWN;
                        break;
                    case '<=':
                        heartbeat.status = numericValue <= monitor._snmpControlValue ? UP : DOWN;
                        break;
                    case '==':
                        heartbeat.status = value === monitor._snmpControlValue ? UP : DOWN;
                        break;
                    case 'contains':
                        heartbeat.status = stringValue.includes(monitor._snmpControlValue) ? UP : DOWN;
                        break;
                    default:
                        heartbeat.status = DOWN;
                        heartbeat.msg = `Invalid condition: ${monitor._snmpCondition}`;
                }
            } else {
                heartbeat.status = DOWN;
                heartbeat.msg = 'No varbinds returned from SNMP session';
            }

            session.close(); // Close the session after use
        } catch (err) {
            console.error("Error in SNMP check:", err); // Log any errors
            heartbeat.status = DOWN;
            heartbeat.msg = `Error: ${err.message}`;
        }
    }

}

module.exports = {
    SNMPMonitorType,
};
