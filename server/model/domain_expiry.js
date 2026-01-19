const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { log, TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD } = require("../../src/util");
const { parse: parseTld } = require("tldts");
const { setting, setSetting } = require("../util-server");
const { Notification } = require("../notification");
const { default: NodeFetchCache, MemoryCache } = require("node-fetch-cache");
const TranslatableError = require("../translatable-error");
const dayjs = require("dayjs");

const cachedFetch = process.env.NODE_ENV
    ? NodeFetchCache.create({
          // cache for 8h
          cache: new MemoryCache({ ttl: 1000 * 60 * 60 * 8 }),
      })
    : fetch;

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

    const services = rdapList["services"] ?? [];
    const rootTld = tld?.split(".").pop();
    if (rootTld) {
        for (const [tlds, urls] of services) {
            if (tlds.includes(rootTld)) {
                return urls[0];
            }
        }
    }
    log.debug("rdap", `No RDAP server found for TLD ${tld}`);
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
    log.debug("domain_expiry", `Send domain expiry notification for ${targetDays} deadline.`);

    for (let notification of notificationList) {
        try {
            log.debug("domain_expiry", `Sending to ${notification.name}`);
            await Notification.send(
                JSON.parse(notification.config),
                `Domain name ${domain} will expire in ${daysRemaining} days`
            );
            sent = true;
        } catch (e) {
            log.error("domain_expiry", `Cannot send domain notification to ${notification.name}:`, e);
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
        return R.findOne("domain_expiry", "domain = ?", [domain]);
    }

    /**
     * @param {string} domain Domain name
     * @returns {DomainExpiry} Domain bean
     */
    static createByName(domain) {
        const d = R.dispense("domain_expiry");
        d.domain = domain;
        return d;
    }

    static parseTld = parseTld;

    /**
     * @typedef {import("tldts-core").IResult} DomainComponents
     * @returns {DomainComponents} parsed domain components
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
     * @throws {TranslatableError} Throws an error if the monitor type is unsupported or missing target.
     * @returns {Promise<{ domain: string, tld: string }>} Domain expiry support info
     */
    static async checkSupport(monitor) {
        if (!(monitor.type in TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD)) {
            throw new TranslatableError("domain_expiry_unsupported_monitor_type");
        }
        const targetField = TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD[monitor.type];
        const target = monitor[targetField];
        if (typeof target !== "string" || target.length === 0) {
            throw new TranslatableError("domain_expiry_unsupported_missing_target");
        }

        const tld = parseTld(target);

        // Avoid logging for incomplete/invalid input while editing monitors.
        if (tld.isIp) {
            throw new TranslatableError("domain_expiry_unsupported_is_ip", { hostname: tld.hostname });
        }
        // No one-letter public suffix exists; treat this as an incomplete/invalid input while typing.
        if (tld.publicSuffix.length < 2) {
            throw new TranslatableError("domain_expiry_public_suffix_too_short", { publicSuffix: tld.publicSuffix });
        }
        if (!tld.isIcann) {
            throw new TranslatableError("domain_expiry_unsupported_is_icann", {
                domain: tld.domain,
                publicSuffix: tld.publicSuffix,
            });
        }

        const publicSuffix = tld.publicSuffix;
        const rootTld = publicSuffix.split(".").pop();
        const rdap = await getRdapServer(publicSuffix);
        if (!rdap) {
            throw new TranslatableError("domain_expiry_unsupported_unsupported_tld_no_rdap_endpoint", {
                publicSuffix,
            });
        }

        return {
            domain: tld.domain,
            tld: rootTld,
        };
    }

    /**
     * @param {string} domainName Domain name
     * @returns {Promise<DomainExpiry>} Domain expiry bean
     */
    static async findByDomainNameOrCreate(domainName) {
        let domain = await DomainExpiry.findByName(domainName);
        if (!domain && domainName) {
            domain = await DomainExpiry.createByName(domainName);
        }
        return domain;
    }

    /**
     * @returns {number} number of days remaining before expiry
     */
    get daysRemaining() {
        return dayjs.utc(this.expiry).diff(dayjs.utc(), "day");
    }

    /**
     * @returns {Promise<(Date|null)>} Expiry date from RDAP
     */
    async getExpiryDate() {
        return getRdapDomainExpiryDate(this.domain);
    }

    /**
     * @param {string} domainName Monitor object
     * @throws {TranslatableError} If the domain is not supported
     * @returns {Promise<Date | undefined>} the expiry date
     */
    static async checkExpiry(domainName) {
        let bean = await DomainExpiry.findByDomainNameOrCreate(domainName);
        let expiryDate;

        if (bean?.lastCheck && dayjs.utc(bean.lastCheck).diff(dayjs.utc(), "day") < 1) {
            log.debug("domain_expiry", `Domain expiry already checked recently for ${bean.domain}, won't re-check.`);
            return bean.expiry;
        } else if (bean) {
            expiryDate = await bean.getExpiryDate();

            if (dayjs.utc(expiryDate).isAfter(dayjs.utc(bean.expiry))) {
                bean.lastExpiryNotificationSent = null;
            }

            bean.expiry = R.isoDateTimeMillis(expiryDate);
            bean.lastCheck = R.isoDateTimeMillis(dayjs.utc());
            await R.store(bean);
        }

        if (expiryDate === null) {
            return;
        }

        return expiryDate;
    }

    /**
     * @param {string} domainName the domain name to send notifications for
     * @param {LooseObject<any>[]} notificationList notification List
     * @returns {Promise<void>}
     */
    static async sendNotifications(domainName, notificationList) {
        const domain = await DomainExpiry.findByDomainNameOrCreate(domainName);
        if (!notificationList.length > 0) {
            // fail fast. If no notification is set, all the following checks can be skipped.
            log.debug("domain_expiry", "No notification, no need to send domain notification");
            return;
        }
        // sanity check if expiry date is valid before calculating days remaining. Should not happen and likely indicates a bug in the code.
        if (!domain.expiry || isNaN(new Date(domain.expiry).getTime())) {
            log.warn(
                "domain_expiry",
                `No valid expiry date passed to sendNotifications for ${domainName} (expiry: ${domain.expiry}), skipping notification`
            );
            return;
        }

        const daysRemaining = domain.daysRemaining;
        const lastSent = domain.lastExpiryNotificationSent;
        log.debug("domain_expiry", `${domainName} expires in ${daysRemaining} days`);

        let notifyDays = await setting("domainExpiryNotifyDays");
        if (notifyDays == null || !Array.isArray(notifyDays)) {
            // Reset Default
            await setSetting("domainExpiryNotifyDays", [7, 14, 21], "general");
            notifyDays = [7, 14, 21];
        }
        if (Array.isArray(notifyDays)) {
            // Asc sort to avoid sending multiple notifications if daysRemaining is below multiple targetDays
            notifyDays.sort((a, b) => a - b);
            for (const targetDays of notifyDays) {
                if (daysRemaining > targetDays) {
                    log.debug(
                        "domain_expiry",
                        `No need to send domain notification for ${domainName} (${daysRemaining} days valid) on ${targetDays} deadline.`
                    );
                    continue;
                } else if (lastSent && lastSent <= targetDays) {
                    log.debug(
                        "domain_expiry",
                        `Notification for ${domainName} on ${targetDays} deadline sent already, no need to send again.`
                    );
                    continue;
                }
                const sent = await sendDomainNotificationByTargetDays(
                    domainName,
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
