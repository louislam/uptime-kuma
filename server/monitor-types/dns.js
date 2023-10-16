const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const dayjs = require("dayjs");
const { dnsResolve, lookup } = require("../util-server");
const { R } = require("redbean-node");

class DnsMonitorType extends MonitorType {

    name = "dns";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();
        let dnsMessage = "";

        let dnsResolveServer = monitor.dns_resolve_server;
        try {
            dnsResolveServer = await lookup(dnsResolveServer, monitor.ipFamily);
        } catch (err) {
            log.debug("monitor", `Error resolving ${monitor.dns_resolve_server}. Error: ${err}`);
            throw new Error(`Error resolving ${monitor.dns_resolve_server}. Error: ${err}`);
        }

        let dnsRes = await dnsResolve(monitor.hostname, dnsResolveServer, monitor.port, monitor.dns_resolve_type);
        heartbeat.ping = dayjs().valueOf() - startTime;

        if (monitor.dns_resolve_type === "A" || monitor.dns_resolve_type === "AAAA" || monitor.dns_resolve_type === "TXT" || monitor.dns_resolve_type === "PTR") {
            dnsMessage += "Records: ";
            dnsMessage += dnsRes.join(" | ");
        } else if (monitor.dns_resolve_type === "CNAME" || monitor.dns_resolve_type === "PTR") {
            dnsMessage += dnsRes[0];
        } else if (monitor.dns_resolve_type === "CAA") {
            dnsMessage += dnsRes[0].issue;
        } else if (monitor.dns_resolve_type === "MX") {
            dnsRes.forEach(record => {
                dnsMessage += `Hostname: ${record.exchange} - Priority: ${record.priority} | `;
            });
            dnsMessage = dnsMessage.slice(0, -2);
        } else if (monitor.dns_resolve_type === "NS") {
            dnsMessage += "Servers: ";
            dnsMessage += dnsRes.join(" | ");
        } else if (monitor.dns_resolve_type === "SOA") {
            dnsMessage += `NS-Name: ${dnsRes.nsname} | Hostmaster: ${dnsRes.hostmaster} | Serial: ${dnsRes.serial} | Refresh: ${dnsRes.refresh} | Retry: ${dnsRes.retry} | Expire: ${dnsRes.expire} | MinTTL: ${dnsRes.minttl}`;
        } else if (monitor.dns_resolve_type === "SRV") {
            dnsRes.forEach(record => {
                dnsMessage += `Name: ${record.name} | Port: ${record.port} | Priority: ${record.priority} | Weight: ${record.weight} | `;
            });
            dnsMessage = dnsMessage.slice(0, -2);
        }

        if (monitor.dns_last_result !== dnsMessage && dnsMessage !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [ dnsMessage, monitor.id ]);
        }

        heartbeat.msg = dnsMessage;
        heartbeat.status = UP;
    }
}

module.exports = {
    DnsMonitorType,
};
