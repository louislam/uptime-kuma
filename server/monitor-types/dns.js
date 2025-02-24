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
        heartbeat.ping = dayjs().valueOf() - startTime;

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => conditions ? evaluateExpressionGroup(conditions, data) : true;

        let records = [];
        switch (monitor.dns_resolve_type) {
            case "A":
            case "AAAA":
                records = dnsRes.answers.map(record => record.address);
                dnsMessage = `Records: ${records.join(" | ")}`;
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "PTR":
                records = dnsRes.answers.map(record => record.domain);
                dnsMessage = `Records: ${records.join(" | ")}`;
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "TXT":
                records = dnsRes.answers.map(record => record.data);
                dnsMessage = `Records: ${records.join(" | ")}`;
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "CNAME":
                records.push(dnsRes.answers[0].domain);
                dnsMessage = records[0];
                conditionsResult = handleConditions({ record: records[0] });
                break;

            case "CAA":
                // dns2 library currently has not implemented decoding CAA response
                //records.push(dnsRes.answers[0].issue);
                records.push("CAA issue placeholder");
                dnsMessage = records[0];
                conditionsResult = handleConditions({ record: records[0] });
                break;

            case "MX":
                records = dnsRes.answers.map(record => record.exchange);
                dnsMessage = dnsRes.answers.map(record => `Hostname: ${record.exchange} ; Priority: ${record.priority}`).join(" | ");
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "NS":
                records = dnsRes.answers.map(record => record.ns);
                dnsMessage = `Servers: ${records.join(" | ")}`;
                conditionsResult = records.some(record => handleConditions({ record }));
                break;

            case "SOA": {
                records.push(dnsRes.answers[0].primary);
                dnsMessage = Object.entries({
                    "Primary-NS": dnsRes.answers[0].primary,
                    "Hostmaster": dnsRes.answers[0].admin,
                    "Serial": dnsRes.answers[0].serial,
                    "Refresh": dnsRes.answers[0].refresh,
                    "Retry": dnsRes.answers[0].retry,
                    "Expire": dnsRes.answers[0].expiration,
                    "MinTTL": dnsRes.answers[0].minimum,
                }).map(([name, value]) => {
                    return `${name}: ${value}`;
                }).join("; ");
                conditionsResult = handleConditions({ record: records[0] });
                break;
            }

            case "SRV":
                records = dnsRes.answers.map(record => record.target);
                dnsMessage = dnsRes.answers.map((record) => {
                    return Object.entries({
                        "Target": record.target,
                        "Port": record.port,
                        "Priority": record.priority,
                        "Weight": record.weight,
                    }).map(([name, value]) => {
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
