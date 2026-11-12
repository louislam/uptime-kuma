const dns = require("dns");
const net = require("net");
const axios = require("axios");
const { Settings } = require("./settings");
const { log } = require("../src/util");

const API_URL = "https://api.ip2location.io/";
const LOOKUP_TIMEOUT_MS = 5000;
const DNS_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// IP -> { geo, timestamp }
const lookupCache = new Map();

// Get the hostname the monitor connects to.
/**
 * @param monitor
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

// Resolve a hostname to an IP. IP inputs are returned as-is.
/**
 * @param host
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
 * Check for private, loopback, link-local and reserved addresses.
 * @param {string} ip IP address to check
 * @returns {boolean} True if the address is not publicly routable
 */
function isReservedIp(ip) {
    const family = net.isIP(ip);

    if (family === 4) {
        const [a, b, c] = ip.split(".").map(Number);
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && ((b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99) || b === 168)) ||
            (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
            (a === 203 && b === 0 && c === 113) ||
            a >= 224
        );
    }

    if (family === 6) {
        const lower = ip.toLowerCase();

        if (lower === "::" || lower === "::1") {
            return true;
        }

        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) {
            return isReservedIp(mapped[1]);
        }

        const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const hi = parseInt(mappedHex[1], 16);
            const lo = parseInt(mappedHex[2], 16);
            return isReservedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
        }

        const first = parseInt(lower.split(":")[0], 16) || 0;
        return (
            (first & 0xfe00) === 0xfc00 ||
            (first & 0xffc0) === 0xfe80 ||
            (first & 0xff00) === 0xff00 ||
            lower.startsWith("2001:db8") ||
            lower.startsWith("2001:0db8")
        );
    }

    return false;
}

// Query IP2Location.io for an IP, cached in memory.
/**
 * @param ip
 * @param apiKey
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

// Fill the monitor's geolocation config. Never throws.
/**
 * @param monitor
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

        if (isReservedIp(ip)) {
            log.debug("ip2location", `Skipping reserved IP ${ip} for monitor '${monitor.name}'`);
            return;
        }

        const apiKey = await Settings.get("ip2locationApiKey");
        const geo = await lookupIp(ip, apiKey);
        if (!geo) {
            return;
        }

        monitor.setConfigValue("ip2location", {
            ip: geo.ip,
            countryCode: geo.countryCode,
            countryName: geo.countryName,
            region: geo.region,
            city: geo.city,
            updated: Date.now(),
        });
    } catch (e) {
        log.debug("ip2location", `Geolocation lookup failed for monitor '${monitor.name}': ${e.message}`);
    }
}

module.exports = {
    applyGeoLocation,
    getMonitorHost,
    isReservedIp,
};
