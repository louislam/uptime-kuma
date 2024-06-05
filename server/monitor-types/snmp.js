const { MonitorType } = require("./monitor-type");
const { UP, DOWN, log } = require("../../src/util");
const snmp = require("net-snmp");
const jsonata = require("jsonata");

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
            version: snmp.Version[monitor.snmpVersion],
        };

        let session;
        try {
            session = snmp.createSession(monitor.hostname, monitor.radiusPassword, options);

            // Handle errors during session creation
            session.on("error", (error) => {
                throw new Error(`Error creating SNMP session: ${error.message}`);
            });

            const varbinds = await new Promise((resolve, reject) => {
                session.get([ monitor.snmpOid ], (error, varbinds) => {
                    error ? reject(error) : resolve(varbinds);
                });
            });
            log.debug("monitor", `SNMP: Received varbinds (Type: ${snmp.ObjectType[varbinds[0].type]} Value: ${varbinds[0].value}`);

            if (varbinds.length === 0) {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);
            }

            if (varbinds[0].type === snmp.ObjectType.NoSuchInstance) {
                throw new Error(`The SNMP query returned that no instance exists for OID ${monitor.snmpOid}`);
            }

            // We restrict querying to one OID per monitor, therefore `varbinds[0]` will always contain the value we're interested in.
            const value = varbinds[0].value;

            // Check if inputs are numeric. If not, re-parse as strings. This ensures comparisons are handled correctly.
            const expectedValue = isNaN(monitor.expectedValue) ? monitor.expectedValue.toString() : parseFloat(monitor.expectedValue);
            let snmpResponse = isNaN(value) ? value.toString() : parseFloat(value);

            let jsonQueryExpression;
            switch (monitor.jsonPathOperator) {
                case ">":
                case ">=":
                case "<":
                case "<=":
                    jsonQueryExpression = `$.value ${monitor.jsonPathOperator} $.control`;
                    break;
                case "==":
                    jsonQueryExpression = "$string($.value) = $string($.control)";
                    break;
                case "contains":
                    jsonQueryExpression = "$contains($string($.value), $string($.control))";
                    break;
                default:
                    throw new Error(`Invalid condition ${monitor.jsonPathOperator}`);
            }

            const expression = jsonata(jsonQueryExpression);
            const evaluation = await expression.evaluate({
                value: snmpResponse,
                control: expectedValue
            });
            heartbeat.status = result ? UP : DOWN;
            heartbeat.msg = `SNMP value ${result ? "passes" : "does not pass"} comparison: ${snmpValue} ${monitor.snmpCondition} ${snmpControlValue}`;

        } catch (err) {
            heartbeat.status = DOWN;
            heartbeat.msg = `SNMP Error: ${err.message}`;
        } finally {
            if (session) {
                session.close();
            }
        }
    }

}

module.exports = {
    SNMPMonitorType,
};
