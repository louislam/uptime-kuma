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
        try {
            const session = new snmp.Session({ host: monitor.ipAddress, community: monitor.snmpCommunityString, version: monitor.snmpVersion });

            session.get({ oid: monitor.snmpOid }, (err, varbinds) => {
                if (err) {
                    heartbeat.status = DOWN;
                    heartbeat.msg = `Error: ${err.message}`;
                    return;
                }

                // Assuming only one varbind is returned
                const value = varbinds[0].value;

                // Convert value to appropriate type based on SNMP type (assuming it's integer or string for simplicity)
                const numericValue = parseInt(value);
                const stringValue = value.toString();

                // Check against condition and control value
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
                        heartbeat.status = value === monitor.snmpControlValue ? UP : DOWN;
                        break;
                    case 'contains':
                        heartbeat.status = stringValue.includes(monitor.snmpControlValue) ? UP : DOWN;
                        break;
                    default:
                        heartbeat.status = DOWN;
                        heartbeat.msg = `Invalid condition: ${monitor.snmpCondition}`;
                }

                session.close();
            });
        } catch (err) {
            heartbeat.status = DOWN;
            heartbeat.msg = `Error: ${err.message}`;
        }
    }

}

module.exports = {
    SNMPMonitorType,
};
