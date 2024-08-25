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

        const conditions = this.supportsConditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        let conditionsResult = null;

        if (monitor.dns_resolve_type === "A" || monitor.dns_resolve_type === "AAAA" || monitor.dns_resolve_type === "TXT" || monitor.dns_resolve_type === "PTR") {
            dnsMessage += "Records: ";
            dnsMessage += dnsRes.join(" | ");
            conditionsResult = conditions
                ? dnsRes.some(record => evaluateExpressionGroup(conditions, { record }))
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "CNAME" || monitor.dns_resolve_type === "PTR") {
            dnsMessage += dnsRes[0];
            conditionsResult = conditions
                ? evaluateExpressionGroup(conditions, { record: dnsRes[0] })
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "CAA") {
            dnsMessage += dnsRes[0].issue;
            conditionsResult = conditions
                ? evaluateExpressionGroup(conditions, { record: dnsRes[0].issue })
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "MX") {
            dnsRes.forEach(record => {
                dnsMessage += `Hostname: ${record.exchange} - Priority: ${record.priority} | `;
            });
            dnsMessage = dnsMessage.slice(0, -2);
            conditionsResult = conditions
                ? dnsRes.some(record => evaluateExpressionGroup(conditions, { record: record.exchange }))
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "NS") {
            dnsMessage += "Servers: ";
            dnsMessage += dnsRes.join(" | ");
            conditionsResult = conditions
                ? dnsRes.some(record => evaluateExpressionGroup(conditions, { record }))
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "SOA") {
            dnsMessage += `NS-Name: ${dnsRes.nsname} | Hostmaster: ${dnsRes.hostmaster} | Serial: ${dnsRes.serial} | Refresh: ${dnsRes.refresh} | Retry: ${dnsRes.retry} | Expire: ${dnsRes.expire} | MinTTL: ${dnsRes.minttl}`;
            conditionsResult = conditions
                ? evaluateExpressionGroup(conditions, { record: dnsRes.nsname })
                : conditionsResult;
        } else if (monitor.dns_resolve_type === "SRV") {
            dnsRes.forEach(record => {
                dnsMessage += `Name: ${record.name} | Port: ${record.port} | Priority: ${record.priority} | Weight: ${record.weight} | `;
            });
            dnsMessage = dnsMessage.slice(0, -2);
            conditionsResult = conditions
                ? dnsRes.some(record => evaluateExpressionGroup(conditions, { record: record.name }))
                : conditionsResult;
        }

        if (monitor.dns_last_result !== dnsMessage && dnsMessage !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [ dnsMessage, monitor.id ]);
        }

        heartbeat.msg = dnsMessage;

        if (conditionsResult !== null) {
            heartbeat.status = conditionsResult ? UP : DOWN;
        } else {
            heartbeat.status = UP;
        }
    }
}

module.exports = {
    DnsMonitorType,
};
