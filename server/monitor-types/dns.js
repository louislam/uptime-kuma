const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const dayjs = require("dayjs");
const { R } = require("redbean-node");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");
const { Resolver } = require("node:dns/promises");
const net = require("node:net");

class DnsMonitorType extends MonitorType {
    name = "dns";

    supportsConditions = true;

    conditionVariables = [new ConditionVariable("record", defaultStringOperators)];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();
        let dnsMessage = "";

        const resolverServers = await this.resolveDnsResolverServers(monitor.dns_resolve_server);
        let dnsRes = await this.dnsResolve(monitor.hostname, resolverServers, monitor.port, monitor.dns_resolve_type);
        heartbeat.ping = dayjs().valueOf() - startTime;

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => (conditions ? evaluateExpressionGroup(conditions, data) : true);

        switch (monitor.dns_resolve_type) {
            case "A":
            case "AAAA":
            case "PTR":
                dnsMessage = `Records: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.some((record) => handleConditions({ record }));
                break;

            case "TXT":
                dnsMessage = `Records: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.flat().some((record) => handleConditions({ record }));
                break;

            case "CNAME":
                dnsMessage = dnsRes[0];
                conditionsResult = handleConditions({ record: dnsRes[0] });
                break;

            case "CAA":
                // .filter(Boolean) was added because some CAA records do not contain an issue key, resulting in a blank list item.
                // Hypothetical dnsRes [{ critical: 0, issuewild: 'letsencrypt.org' }, { critical: 0, issue: 'letsencrypt.org' }]
                dnsMessage = `Records: ${dnsRes
                    .map((record) => record.issue)
                    .filter(Boolean)
                    .join(" | ")}`;
                conditionsResult = dnsRes.some((record) => handleConditions({ record: record.issue }));
                break;

            case "MX":
                dnsMessage = dnsRes
                    .map((record) => `Hostname: ${record.exchange} - Priority: ${record.priority}`)
                    .join(" | ");
                conditionsResult = dnsRes.some((record) => handleConditions({ record: record.exchange }));
                break;

            case "NS":
                dnsMessage = `Servers: ${dnsRes.join(" | ")}`;
                conditionsResult = dnsRes.some((record) => handleConditions({ record }));
                break;

            case "SOA":
                dnsMessage = `NS-Name: ${dnsRes.nsname} | Hostmaster: ${dnsRes.hostmaster} | Serial: ${dnsRes.serial} | Refresh: ${dnsRes.refresh} | Retry: ${dnsRes.retry} | Expire: ${dnsRes.expire} | MinTTL: ${dnsRes.minttl}`;
                conditionsResult = handleConditions({ record: dnsRes.nsname });
                break;

            case "SRV":
                dnsMessage = dnsRes
                    .map(
                        (record) =>
                            `Name: ${record.name} | Port: ${record.port} | Priority: ${record.priority} | Weight: ${record.weight}`
                    )
                    .join(" | ");
                conditionsResult = dnsRes.some((record) => handleConditions({ record: record.name }));
                break;
        }

        if (monitor.dns_last_result !== dnsMessage && dnsMessage !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [dnsMessage, monitor.id]);
        }

        if (!conditionsResult) {
            throw new Error(dnsMessage);
        }

        heartbeat.msg = dnsMessage;
        heartbeat.status = UP;
    }

    /**
     * Parses a comma-separated list of DNS resolver servers and resolves any hostnames
     * to their corresponding IPv4 and/or IPv6 addresses.
     *
     * We are primarily doing this to support hostnames of docker containers like adguard.
     *
     * - Whitespace is removed from the input string
     * - Empty entries are ignored
     * - IP literals (IPv4 / IPv6) are accepted as-is
     * - Hostnames are resolved to both A and AAAA records in parallel
     * - Invalid or unresolvable entries are logged and skipped
     * @param {string} dnsResolveServer - Comma-separated list of resolver servers (IPs or hostnames)
     * @returns {Promise<Array<string>>} Array of resolved IP addresses
     * @throws {Error} If no valid resolver servers could be parsed or resolved
     */
    async resolveDnsResolverServers(dnsResolveServer) {
        // Remove all spaces, split into array, remove all elements that are empty
        const addresses = dnsResolveServer
            .replace(/\s/g, "")
            .split(",")
            .filter((x) => x !== "");
        if (!addresses.length) {
            throw new Error(
                "No Resolver Servers specified. Please specifiy at least one resolver server like 1.1.1.1 or a hostname"
            );
        }
        const resolver = new Resolver();

        // Make promises to be resolved concurrently
        const promises = addresses.map(async (e) => {
            if (net.isIP(e)) {
                // If IPv4 or IPv6 addr, immediately return
                return [e];
            }

            // Otherwise, attempt to resolve hostname
            const [v4, v6] = await Promise.allSettled([resolver.resolve4(e), resolver.resolve6(e)]);

            const addrs = [
                ...(v4.status === "fulfilled" ? v4.value : []),
                ...(v6.status === "fulfilled" ? v6.value : []),
            ];

            if (!addrs.length) {
                log.error("DNS", `Invalid resolver server ${e}`);
            }
            return addrs;
        });

        // [[ips of hostname1],[ips hostname2],...]
        const ips = await Promise.all(promises);
        // Append all the ips in [[]] to a single []
        const parsed = ips.flat();

        // only the resolver resolution can discard an address
        // -> no special error message for only the net.isIP case is necessary
        if (!parsed.length) {
            throw new Error(
                "None of the configured resolver servers could be resolved to an IP address. Please provide a comma-separated list of valid resolver hostnames or IP addresses."
            );
        }
        return parsed;
    }

    /**
     * Resolves a given record using the specified DNS server
     * @param {string} hostname The hostname of the record to lookup
     * @param {string[]} resolverServer Array of DNS server IP addresses to use
     * @param {string} resolverPort Port the DNS server is listening on
     * @param {string} rrtype The type of record to request
     * @returns {Promise<(string[] | object[] | object)>} DNS response
     */
    async dnsResolve(hostname, resolverServer, resolverPort, rrtype) {
        const resolver = new Resolver();
        resolver.setServers(resolverServer.map((server) => `[${server}]:${resolverPort}`));
        if (rrtype === "PTR") {
            return await resolver.reverse(hostname);
        }
        return await resolver.resolve(hostname, rrtype);
    }
}

module.exports = {
    DnsMonitorType,
};
