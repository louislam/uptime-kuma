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

        let dnsRes = await dnsResolve(monitor.hostname, monitor.dns_resolve_server, monitor.port, monitor.dns_resolve_type);
        heartbeat.ping = dayjs().valueOf() - startTime;

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => conditions ? evaluateExpressionGroup(conditions, data) : true;

        switch (monitor.dns_resolve_type) {
            case "A":
            case "AAAA":
            case "PTR":
                dnsMessage = `Records: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.some(record => handleConditions({ record }));
                break;

            case "TXT":
                dnsMessage = `Records: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.flat().some(record => handleConditions({ record }));
                break;

            case "CNAME":
                dnsMessage = dnsRes[0];
                conditionsResult = handleConditions({ record: dnsRes[0] });
                break;

            case "CAA":
                dnsMessage = dnsRes[0].issue;
                conditionsResult = handleConditions({ record: dnsRes[0].issue });
                break;

            case "MX":
                dnsMessage = dnsRes.map(record => `Hostname: ${record.exchange} - Priority: ${record.priority}`).join(" | ");
                conditionsResult = dnsRes.some(record => handleConditions({ record: record.exchange }));
                break;

            case "NS":
                dnsMessage = `Servers: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.some(record => handleConditions({ record }));
                break;

            case "SOA":
                dnsMessage = `NS-Name: ${dnsRes.nsname} | Hostmaster: ${dnsRes.hostmaster} | Serial: ${dnsRes.serial} | Refresh: ${dnsRes.refresh} | Retry: ${dnsRes.retry} | Expire: ${dnsRes.expire} | MinTTL: ${dnsRes.minttl}`;
                conditionsResult = handleConditions({ record: dnsRes.nsname });
                break;

            case "SRV":
                dnsMessage = dnsRes.map(record => `Name: ${record.name} | Port: ${record.port} | Priority: ${record.priority} | Weight: ${record.weight}`).join(" | ");
                conditionsResult = dnsRes.some(record => handleConditions({ record: record.name }));
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
