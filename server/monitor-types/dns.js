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
     * Validate hostname to ensure it's a valid domain without protocol or path
     * @param {string} hostname Hostname to validate
     * @returns {boolean} True if hostname is valid
     */
    validateHostname(hostname) {
        try {
            // First check if hostname contains protocol or path
            if (hostname.includes("/") || hostname.includes(":")) {
                return false;
            }

            // Try to construct a URL with a dummy protocol
            const url = new URL(`http://${hostname}`);

            // Ensure there's no path or query parameters
            if (url.pathname !== "/" || url.search !== "") {
                return false;
            }

            // Ensure the hostname matches the original input
            // This catches cases where the URL constructor might "fix" invalid hostnames
            return url.hostname === hostname;
        } catch (error) {
            return false;
        }
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        // Validate hostname before proceeding
        if (!this.validateHostname(monitor.hostname)) {
            heartbeat.msg = "Invalid hostname format";
            heartbeat.status = DOWN;
            return;
        }

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
            case "TXT":
            case "PTR":
                dnsMessage = `Records: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.some(record => handleConditions({ record }));
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
