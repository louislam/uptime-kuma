const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { log } = require("../../src/util");
const { parse: parseTld } = require("tldts");
const { getDaysRemaining, getDaysBetween, setting, setSetting } = require("../util-server");
const { Notification } = require("../notification");
const { default: NodeFetchCache, MemoryCache } = require("node-fetch-cache");

const TABLE = "domain_expiry";
const urlTypes = [ "websocket-upgrade", "http", "keyword", "json-query", "real-browser" ];
const excludeTypes = [ "docker", "group", "push", "manual", "rabbitmq", "redis" ];

const cachedFetch = process.env.NODE_ENV ? NodeFetchCache.create({
    // cache for 8h
    cache: new MemoryCache({ ttl: 1000 * 60 * 60 * 8 })
}) : fetch;

/**
 * Find the RDAP server for a given TLD
 * @param {string} tld TLD
 * @returns {Promise<string>} First RDAP server found
 */
async function getRdapServer(tld) {
    let rdapList;
    try {
        const res = await cachedFetch("https://data.iana.org/rdap/dns.json");
        rdapList = await res.json();
    } catch (error) {
        log.debug("rdap", error);
        return null;
    }

    for (const service of rdapList["services"]) {
        const [ tlds, urls ] = service;
        if (tlds.includes(tld)) {
            return urls[0];
        }
    }
    return null;
}

/**
 * Request RDAP server to retrieve the expiry date of a domain
 * @param {string} domain Domain to retrieve the expiry date from
 * @returns {Promise<(Date|null)>} Expiry date from RDAP server
 */
async function getRdapDomainExpiryDate(domain) {
    const tld = DomainExpiry.parseTld(domain).publicSuffix;
    const rdapServer = await getRdapServer(tld);
    if (rdapServer === null) {
        log.warn("rdap", `No RDAP server found, TLD ${tld} not supported.`);
        return null;
    }
    const url = `${rdapServer}domain/${domain}`;

    let rdapInfos;
    try {
        const res = await fetch(url);
        if (res.status !== 200) {
            return null;
        }
        rdapInfos = await res.json();
    } catch {
        log.warn("rdap", "Not able to get expiry date from RDAP");
        return null;
    }

    if (rdapInfos["events"] === undefined) {
        return null;
    }
    for (const event of rdapInfos["events"]) {
        if (event["eventAction"] === "expiration") {
            return new Date(event["eventDate"]);
        }
    }
    return null;
}

/**
 * Send a certificate notification when domain expires in less than target days
 * @param {string} domain Domain we monitor
 * @param {number} daysRemaining Number of days remaining on certificate
 * @param {number} targetDays Number of days to alert after
 * @param {LooseObject<any>[]} notificationList List of notification providers
 * @returns {Promise<void>}
 */
async function sendDomainNotificationByTargetDays(domain, daysRemaining, targetDays, notificationList) {
    let sent = false;
    log.debug("domain", `Send domain expiry notification for ${targetDays} deadline.`);

    for (let notification of notificationList) {
        try {
            log.debug("domain", `Sending to ${notification.name}`);
            await Notification.send(
                JSON.parse(notification.config),
                `Domain name ${domain} will expire in ${daysRemaining} days`
            );
            sent = true;
        } catch (e) {
            log.error("domain", `Cannot send domain notification to ${notification.name}`);
            log.error("domain", e);
        }
    }

    return sent;
}

class DomainExpiry extends BeanModel {
    /**
     * @param {string} domain Domain name
     * @returns {Promise<DomainExpiry>} Domain bean
     */
    static async findByName(domain) {
        return R.findOne(TABLE, "domain = ?", [ domain ]);
    }

    /**
     * @param {string} domain Domain name
     * @returns {DomainExpiry} Domain bean
     */
    static createByName(domain) {
        const d = R.dispense(TABLE);
        d.domain = domain;
        return d;
    }

    static parseTld = parseTld;

    /**
     * @returns {(object)} parsed domain components
     */
    parseName() {
        return parseTld(this.domain);
    }

    /**
     * @returns {(null|object)} parsed domain tld
     */
    get tld() {
        return this.parseName().publicSuffix;
    }

    /**
     * @param {Monitor} monitor Monitor object
     * @returns {Promise<DomainExpiry>} Domain expiry bean
     */
    static async forMonitor(monitor) {
        const m = monitor;
        if (excludeTypes.includes(m.type) || m.type?.match(/sql$/)) {
            return false;
        }
        const tld = parseTld(urlTypes.includes(m.type) ? m.url : m.type === "grpc-keyword" ? m.grpcUrl : m.hostname);
        const rdap = await getRdapServer(tld.publicSuffix);
        if (!rdap) {
            log.warn("domain", `${tld.publicSuffix} is not supported. File a bug report if you believe it should be.`);
            return false;
        }
        const existing = await DomainExpiry.findByName(tld.domain);
        if (existing) {
            return existing;
        }
        if (tld.domain) {
            return await DomainExpiry.createByName(tld.domain);
        }
    }

    /**
     * @returns {number} number of days remaining before expiry
     */
    get daysRemaining() {
        return getDaysRemaining(new Date(), new Date(this.expiry));
    }

    /**
     * @returns {Promise<(Date|null)>} Expiry date from RDAP
     */
    async getExpiryDate() {
        return getRdapDomainExpiryDate(this.domain);
    }

    /**
     * @param {(Monitor)} monitor Monitor object
     * @returns {Promise<void>}
     */
    static async checkExpiry(monitor) {

        let bean = await DomainExpiry.forMonitor(monitor);

        let expiryDate;
        if (bean?.lastCheck && getDaysBetween(new Date(bean.lastCheck), new Date()) < 1) {
            log.debug("domain", `Domain expiry already checked recently for ${bean.domain}, won't re-check.`);
            return bean.expiry;
        } else if (bean) {
            expiryDate = await bean.getExpiryDate();

            if (new Date(expiryDate) > new Date(bean.expiry)) {
                bean.lastExpiryNotificationSent = null;
            }

            bean.expiry = expiryDate;
            bean.lastCheck = new Date();
            await R.store(bean);
        }

        if (expiryDate === null) {
            return;
        }

        return expiryDate;
    }

    /**
     * @param {Monitor} monitor Monitor instance
     * @param {LooseObject<any>[]} notificationList notification List
     * @returns {Promise<void>}
     */
    static async sendNotifications(monitor, notificationList) {
        const domain = await DomainExpiry.forMonitor(monitor);
        const name = domain.domain;

        if (!notificationList.length > 0) {
            // fail fast. If no notification is set, all the following checks can be skipped.
            log.debug("domain", "No notification, no need to send domain notification");
            return;
        }

        const daysRemaining = getDaysRemaining(new Date(), domain.expiry);
        const lastSent = domain.lastExpiryNotificationSent;
        log.debug("domain", `${name} expires in ${daysRemaining} days`);

        let notifyDays = await setting("domainExpiryNotifyDays");
        if (notifyDays == null || !Array.isArray(notifyDays)) {
            // Reset Default
            await setSetting("domainExpiryNotifyDays", [ 7, 14, 21 ], "general");
            notifyDays = [ 7, 14, 21 ];
        }
        if (Array.isArray(notifyDays)) {
            // Asc sort to avoid sending multiple notifications if daysRemaining is below multiple targetDays
            notifyDays.sort((a, b) => a - b);
            for (const targetDays of notifyDays) {
                if (daysRemaining > targetDays) {
                    log.debug(
                        "domain",
                        `No need to send domain notification for ${name} (${daysRemaining} days valid) on ${targetDays} deadline.`
                    );
                    continue;
                } else if (lastSent && lastSent <= targetDays) {
                    log.debug(
                        "domain",
                        `Notification for ${name} on ${targetDays} deadline sent already, no need to send again.`
                    );
                    continue;
                }
                const sent = await sendDomainNotificationByTargetDays(
                    name,
                    daysRemaining,
                    targetDays,
                    notificationList
                );
                if (sent) {
                    domain.lastExpiryNotificationSent = targetDays;
                    await R.store(domain);
                    return targetDays;
                }
            }
        }
    }
}

module.exports = DomainExpiry;
