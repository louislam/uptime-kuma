const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const dayjs = require("dayjs");
const { dnsResolve } = require("../util-server");
const { R } = require("redbean-node");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class DnsMonitorType extends MonitorType {
    name = "dns";

    supportsConditions = true;

    conditionVariables = [
        new ConditionVariable("record", defaultStringOperators ),
    ];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();
        let dnsMessage = "";

        let dnsRes = await dnsResolve(monitor.hostname, monitor.dns_resolve_server, monitor.port, monitor.dns_resolve_type, monitor.dns_transport, monitor.doh_query_path);
        const records = dnsRes.answers.map(record => {
            return Buffer.isBuffer(record.data) ? record.data.toString() : record.data;
        });
        heartbeat.ping = dayjs().valueOf() - startTime;

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => conditions ? evaluateExpressionGroup(conditions, data) : true;

        switch (monitor.dns_resolve_type) {
            case "A":
            case "AAAA":
            case "TXT":
            case "PTR":
            case "NS":
                dnsMessage = records.join(" | ");
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "CNAME":
                dnsMessage = records[0];
                conditionsResult = handleConditions({ record: records[0] });
                break;

            case "CAA":
                dnsMessage = records.map(record => `${record.flags} ${record.tag} "${record.value}"`).join(" | ");
                conditionsResult = handleConditions({ record: records[0] });
                break;

            case "MX":
                dnsMessage = records.map(record => `Hostname: ${record.exchange}; Priority: ${record.priority}`).join(" | ");
                conditionsResult = records.some(record => handleConditions({ record }));
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
                conditionsResult = handleConditions({ record: records[0] });
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
                conditionsResult = records.some(record => handleConditions({ record }));
                break;
        }

        if (monitor.dns_last_result !== dnsMessage && dnsMessage !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [ dnsMessage, monitor.id ]);
        }

        heartbeat.msg = dnsMessage;
        heartbeat.status = conditionsResult ? UP : DOWN;
    }
}

module.exports = {
    DnsMonitorType,
};
