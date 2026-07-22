const { MonitorType } = require("./monitor-type");
const {
    UP,
    PING_COUNT_DEFAULT,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
} = require("../../src/util");
const { Settings } = require("../settings");
const { ping, checkStatusCode } = require("../util-server");
const axios = require("axios");
const crypto = require("crypto");
const dns = require("node:dns/promises");
const http = require("http");
const https = require("https");
const net = require("node:net");

class SteamMonitorType extends MonitorType {
    name = "steam";

    /**
     * Creates a Steam monitor type.
     * @param {object} options Optional dependencies for tests.
     * @param {object} options.steamApiClient Axios-compatible Steam API client.
     * @param {Function} options.lookup DNS lookup function.
     * @param {Function} options.getSteamAPIKey Steam API key provider.
     * @param {Function} options.ping Steam server ping function.
     */
    constructor(options = {}) {
        super();

        this.steamApiClient = options.steamApiClient || axios;
        this.lookup = options.lookup || dns.lookup;
        this.getSteamAPIKey = options.getSteamAPIKey || (() => Settings.get("steamAPIKey"));
        this.ping = options.ping || ping;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat) {
        const steamApiUrl = "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
        const steamAPIKey = await this.getSteamAPIKey();

        if (!steamAPIKey) {
            throw new Error("Steam API Key not found");
        }

        const filter = await this.buildServerFilter(monitor.hostname, monitor.port);

        let res = await this.steamApiClient.get(steamApiUrl, {
            timeout: monitor.timeout * 1000,
            headers: {
                Accept: "*/*",
            },
            httpsAgent: new https.Agent({
                maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                rejectUnauthorized: !monitor.getIgnoreTls(),
                secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
            }),
            httpAgent: new http.Agent({
                maxCachedSessions: 0,
            }),
            maxRedirects: monitor.maxredirects,
            validateStatus: (status) => {
                return checkStatusCode(status, monitor.getAcceptedStatuscodes());
            },
            params: {
                filter: filter,
                key: steamAPIKey,
            },
        });

        if (res.data.response && res.data.response.servers && res.data.response.servers.length > 0) {
            heartbeat.status = UP;
            heartbeat.msg = res.data.response.servers[0].name;

            try {
                heartbeat.ping = await this.ping(
                    monitor.hostname,
                    PING_COUNT_DEFAULT,
                    "",
                    true,
                    monitor.packetSize,
                    PING_GLOBAL_TIMEOUT_DEFAULT,
                    PING_PER_REQUEST_TIMEOUT_DEFAULT
                );
            } catch (_) {}
        } else {
            throw new Error("Server not found on Steam");
        }
    }

    /**
     * Builds the Steam API server filter.
     * @param {string} hostname Steam server hostname or IP address.
     * @param {number} port Steam server port.
     * @returns {Promise<string>} Steam API addr filter.
     */
    async buildServerFilter(hostname, port) {
        const resolvedHostname = await this.resolveSteamHostname(hostname);
        return `addr\\${resolvedHostname}:${port}`;
    }

    /**
     * Resolves hostnames before passing them to Steam's addr filter.
     * @param {string} hostname Steam server hostname or IP address.
     * @returns {Promise<string>} IP address accepted by the Steam API.
     * @throws {Error} When the hostname cannot be resolved.
     */
    async resolveSteamHostname(hostname) {
        if (net.isIP(hostname)) {
            return hostname;
        }

        try {
            const lookupResult = await this.lookup(hostname, { all: true });
            const addresses = Array.isArray(lookupResult) ? lookupResult : [lookupResult];
            const ipv4Address = addresses.find(({ address }) => net.isIP(address) === 4);
            const resolvedAddress = ipv4Address?.address || addresses[0]?.address;

            if (!resolvedAddress) {
                throw new Error("DNS lookup returned no addresses");
            }

            return resolvedAddress;
        } catch (error) {
            throw new Error(`Unable to resolve Steam server hostname "${hostname}": ${error.message}`);
        }
    }
}

module.exports = {
    SteamMonitorType,
};
