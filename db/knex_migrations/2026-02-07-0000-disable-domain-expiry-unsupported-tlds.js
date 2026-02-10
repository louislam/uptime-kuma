const { parse: parseTld } = require("tldts");
const rdapDnsData = require("../../server/model/rdap-dns.json");

const TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD = {
    http: "url",
    keyword: "url",
    "json-query": "url",
    "real-browser": "url",
    "websocket-upgrade": "url",
    port: "hostname",
    ping: "hostname",
    "grpc-keyword": "grpc_url",
    dns: "hostname",
    smtp: "hostname",
    snmp: "hostname",
    gamedig: "hostname",
    steam: "hostname",
    mqtt: "hostname",
    radius: "hostname",
    "tailscale-ping": "hostname",
    "sip-options": "hostname",
};

/**
 * Build set of root TLDs that have RDAP support
 * @returns {Set<string>} Set of supported root TLDs
 */
function getSupportedTlds() {
    const supported = new Set();
    const services = rdapDnsData["services"] ?? [];
    for (const [tlds] of services) {
        for (const tld of tlds) {
            supported.add(tld);
        }
    }
    return supported;
}

/**
 * Check if a target URL/hostname has RDAP support
 * @param {string} target URL or hostname
 * @param {Set<string>} supportedTlds Set of supported root TLDs
 * @returns {boolean} Whether the target's TLD has RDAP support
 */
function hasRdapSupport(target, supportedTlds) {
    if (!target || typeof target !== "string") {
        return false;
    }
    const tld = parseTld(target);
    if (!tld.publicSuffix || !tld.isIcann) {
        return false;
    }
    const rootTld = tld.publicSuffix.split(".").pop();
    return supportedTlds.has(rootTld);
}

exports.up = async function (knex) {
    const supportedTlds = getSupportedTlds();

    const monitors = await knex("monitor")
        .where("domain_expiry_notification", 1)
        .select("id", "type", "url", "hostname", "grpc_url");

    const idsToDisable = [];
    for (const monitor of monitors) {
        const targetField = TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD[monitor.type];
        if (!targetField || !hasRdapSupport(monitor[targetField], supportedTlds)) {
            idsToDisable.push(monitor.id);
        }
    }

    if (idsToDisable.length > 0) {
        await knex("monitor").whereIn("id", idsToDisable).update("domain_expiry_notification", 0);
    }

    await knex.schema.alterTable("monitor", function (table) {
        table.boolean("domain_expiry_notification").defaultTo(0).alter();
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.boolean("domain_expiry_notification").defaultTo(1).alter();
    });
};
