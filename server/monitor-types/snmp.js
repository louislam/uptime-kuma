const { MonitorType } = require("./monitor-type");
const { UP, log, evaluateJsonQuery } = require("../../src/util");
const snmp = require("net-snmp");

class SNMPMonitorType extends MonitorType {
    name = "snmp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let session;
        try {
            const sessionOptions = {
                port: monitor.port || "161",
                retries: monitor.maxretries,
                timeout: monitor.timeout * 1000,
                version: snmp.Version[monitor.snmpVersion],
            };

            if (monitor.snmpVersion === "3") {
                if (!monitor.snmp_v3_username) {
                    throw new Error("SNMPv3 username is required");
                }
                // SNMPv3 currently defaults to noAuthNoPriv.
                // Supporting authNoPriv / authPriv requires additional inputs
                // (auth/priv protocols, passwords), validation, secure storage,
                // and database migrations, which is intentionally left for
                // a follow-up PR to keep this change scoped.
                sessionOptions.securityLevel = snmp.SecurityLevel.noAuthNoPriv;
                sessionOptions.username = monitor.snmp_v3_username;
                session = snmp.createV3Session(monitor.hostname, monitor.snmp_v3_username, sessionOptions);
            } else {
                session = snmp.createSession(monitor.hostname, monitor.radiusPassword, sessionOptions);
            }

            // Handle errors during session creation
            session.on("error", (error) => {
                throw new Error(`Error creating SNMP session: ${error.message}`);
            });

            const varbinds = await new Promise((resolve, reject) => {
                session.get([monitor.snmpOid], (error, varbinds) => {
                    error ? reject(error) : resolve(varbinds);
                });
            });
            log.debug(
                this.name,
                `SNMP: Received varbinds (Type: ${snmp.ObjectType[varbinds[0].type]} Value: ${varbinds[0].value})`
            );

            if (varbinds.length === 0) {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);
            }

            if (varbinds[0].type === snmp.ObjectType.NoSuchInstance) {
                throw new Error(`The SNMP query returned that no instance exists for OID ${monitor.snmpOid}`);
            }

            // We restrict querying to one OID per monitor, therefore `varbinds[0]` will always contain the value we're interested in.
            const value = varbinds[0].value;

            const { status, response } = await evaluateJsonQuery(
                value,
                monitor.jsonPath,
                monitor.jsonPathOperator,
                monitor.expectedValue
            );

            if (status) {
                heartbeat.status = UP;
                heartbeat.msg = `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`;
            } else {
                throw new Error(
                    `JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`
                );
            }
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
