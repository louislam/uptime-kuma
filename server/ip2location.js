const dns = require("dns");
const net = require("net");
const axios = require("axios");
const { Settings } = require("./settings");
const { log } = require("../src/util");

const API_URL = "https://api.ip2location.io/";
const LOOKUP_TIMEOUT_MS = 5000;
const DNS_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// IP -> { geo, timestamp }, avoids repeating API calls for the same address
const lookupCache = new Map();

/**
 * Extract the hostname a monitor connects to.
 * @param {object} monitor Monitor bean or plain object
 * @returns {?string} Hostname / IP, or null if the monitor has no host
 */
function getMonitorHost(monitor) {
    for (const value of [monitor.url, monitor.hostname]) {
        if (!value || typeof value !== "string") {
            continue;
        }

        let host = value.trim();

        try {
            if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
                return new URL(host).hostname;
            }
        } catch (e) {
            // fall through to manual parsing
        }

        host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
        host = host.split("/")[0].split("?")[0];
        if (host.includes("@")) {
            host = host.split("@").pop();
        }

        // Keep IPv6 addresses intact: [::1]:443
        const ipv6 = host.match(/^\[(.+)\](?::\d+)?$/);
        if (ipv6) {
            return ipv6[1];
        }

        host = host.replace(/:\d+$/, "");
        if (host) {
            return host;
        }
    }

    return null;
}

/**
 * Resolve a hostname to an IP address. IP inputs are returned unchanged.
 * @param {string} host Hostname or IP literal
 * @returns {Promise<?string>} Resolved IP address
 */
async function resolveHost(host) {
    if (net.isIP(host)) {
        return host;
    }

    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`DNS lookup for '${host}' timed out`)), DNS_TIMEOUT_MS);
    });

    try {
        const result = await Promise.race([dns.promises.lookup(host), timeout]);
        return result.address || null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Query the IP2Location.io API for an IP address.
 * @param {string} ip IP address to look up
 * @param {?string} apiKey IP2Location.io API key
 * @returns {Promise<?object>} Geolocation fields, or null when unavailable
 */
async function lookupIp(ip, apiKey) {
    const cached = lookupCache.get(ip);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.geo;
    }

    const params = { ip };
    if (apiKey) {
        params.key = apiKey;
    }

    const res = await axios.get(API_URL, {
        params,
        timeout: LOOKUP_TIMEOUT_MS,
    });

    const data = res.data || {};

    if (data.error) {
        throw new Error(data.error.error_message || "IP2Location.io API error");
    }

    const geo = {
        ip,
        countryCode: data.country_code || null,
        countryName: data.country_name || null,
        region: data.region_name || null,
        city: data.city_name || null,
    };

    lookupCache.set(ip, { geo, timestamp: Date.now() });
    return geo;
}

/**
 * Resolve the monitor's host and fill in its geolocation columns.
 * Does nothing (and never throws) when the feature is disabled or the lookup fails.
 * @param {object} monitor Monitor bean to update (not saved here)
 * @returns {Promise<void>}
 */
async function applyGeoLocation(monitor) {
    try {
        if (!(await Settings.get("ip2locationEnabled"))) {
            return;
        }

        const host = getMonitorHost(monitor);
        if (!host) {
            return;
        }

        const ip = await resolveHost(host);
        if (!ip) {
            return;
        }

        const apiKey = await Settings.get("ip2locationApiKey");
        const geo = await lookupIp(ip, apiKey);
        if (!geo) {
            return;
        }

        monitor.ip2location_ip = geo.ip;
        monitor.ip2location_country_code = geo.countryCode;
        monitor.ip2location_country_name = geo.countryName;
        monitor.ip2location_region = geo.region;
        monitor.ip2location_city = geo.city;
        monitor.ip2location_updated = Date.now();
    } catch (e) {
        log.debug("ip2location", `Geolocation lookup failed for monitor '${monitor.name}': ${e.message}`);
    }
}

module.exports = {
    applyGeoLocation,
    getMonitorHost,
};
