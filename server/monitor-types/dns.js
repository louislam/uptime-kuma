const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const dayjs = require("dayjs");
const { dnsResolve } = require("../util-server");
const { R } = require("redbean-node");
const { ConditionVariable } = require("../monitor-conditions/variables");
const {
    defaultStringOperators,
    defaultNumberOperators,
    defaultArrayOperators
} = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class DnsMonitorType extends MonitorType {
    name = "dns";

    supportsConditions = true;

    conditionVariables = [
        // A, AAAA, TXT, NS
        new ConditionVariable("records", defaultArrayOperators),
        // PTR, CNAME
        new ConditionVariable("hostname", defaultStringOperators),
        // CAA
        new ConditionVariable("flags", defaultStringOperators),
        new ConditionVariable("tag", defaultStringOperators),
        new ConditionVariable("value", defaultStringOperators),
        // MX
        new ConditionVariable("hostnames", defaultArrayOperators),
        // SOA
        new ConditionVariable("mname", defaultStringOperators),
        new ConditionVariable("rname", defaultStringOperators),
        new ConditionVariable("serial", defaultStringOperators),
        new ConditionVariable("refresh", defaultNumberOperators),
        new ConditionVariable("retry", defaultNumberOperators),
        new ConditionVariable("minimum", defaultNumberOperators),
        // SRV
        new ConditionVariable("targets", defaultArrayOperators),
    ];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const requestData = {
            name: monitor.hostname,
            rrtype: monitor.dnsResolveType,
            dnssec: true, // Request DNSSEC information in the response
            dnssecCheckingDisabled: monitor.skipRemoteDnssec,
        };
        const transportData = {
            type: monitor.dnsTransport,
            timeout: monitor.timeout,
            ignoreCertErrors: monitor.ignoreTls,
            dohQueryPath: monitor.dohQueryPath,
            dohUsePost: monitor.method === "POST",
            dohUseHttp2: monitor.forceHttp2,
        };

        let startTime = dayjs().valueOf();
        let dnsRes = await dnsResolve(requestData, monitor.dnsResolveServer, monitor.port, transportData);
        heartbeat.ping = dayjs().valueOf() - startTime;

        let dnsMessage = "";
        let rrtype = monitor.dnsResolveType;
        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => conditions ? evaluateExpressionGroup(conditions, data) : true;
        const checkRecord = (results, record) => {
            // Omit records that are not the same as the requested rrtype
            if (record.type === monitor.dnsResolveType) {
                // Add the record to the array
                results.push(Buffer.isBuffer(record.data) ? record.data.toString() : record.data);
            }
            return results;
        };

        const records = dnsRes.answers.reduce(checkRecord, []);
        // Return down status if no records are provided
        if (records.length === 0) {
            if (dnsRes.authorities.map(auth => auth.type).includes(monitor.dnsResolveType)) {
                records.push(...dnsRes.authorities.reduce(checkRecord, []));
            } else {
                rrtype = null;
                dnsMessage = "No records found";
                conditionsResult = false;
            }
        }

        switch (rrtype) {
            case "A":
            case "AAAA":
            case "TXT":
            case "NS":
                dnsMessage = records.join(" | ");
                conditionsResult = handleConditions({ records: records });
                break;

            case "PTR":
            case "CNAME":
                dnsMessage = records[0];
                conditionsResult = handleConditions({ hostname: records[0].value });
                break;

            case "CAA":
                dnsMessage = records.map(record => `${record.flags} ${record.tag} "${record.value}"`).join(" | ");
                conditionsResult = handleConditions(records[0]);
                break;

            case "MX":
                dnsMessage = records.map(record => `Hostname: ${record.exchange}; Priority: ${record.priority}`).join(" | ");
                conditionsResult = handleConditions({ hostnames: records.map(record => record.exchange) });
                break;

            case "SOA": {
                dnsMessage = Object.entries({
                    "Primary-NS": records[0].mname,
                    "Hostmaster": records[0].rname,
                    "Serial": records[0].serial,
                    "Refresh": records[0].refresh,
                    "Retry": records[0].retry,
                    "Expire": records[0].expire,
                    "MinTTL": records[0].minimum,
                }).map(([ name, value ]) => {
                    return `${name}: ${value}`;
                }).join("; ");
                conditionsResult = handleConditions(records[0]);
                break;
            }

            case "SRV":
                dnsMessage = records.map((record) => {
                    return Object.entries({
                        "Target": record.target,
                        "Port": record.port,
                        "Priority": record.priority,
                        "Weight": record.weight,
                    }).map(([ name, value ]) => {
                        return `${name}: ${value}`;
                    }).join("; ");
                }).join(" | ");
                conditionsResult = handleConditions({ targets: records.map(record => record.target) });
                break;
        }

        if (monitor.dnsLastResult !== dnsMessage && dnsMessage !== undefined && monitor.id !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [ dnsMessage, monitor.id ]);
        }

        heartbeat.msg = dnsMessage;
        heartbeat.status = conditionsResult ? UP : DOWN;
    }
}

module.exports = {
    DnsMonitorType,
};
