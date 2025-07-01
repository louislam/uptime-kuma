const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const Gamedig = require("gamedig");
const dns = require("dns").promises;

class GameDigMonitorType extends MonitorType {
    name = "gamedig";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        heartbeat.status = DOWN;

        let host = monitor.hostname;

        if (monitor.gamedigResolveHostToIP) {
            host = await this.resolveHostname(monitor.hostname);
        }

        try {
            const state = await Gamedig.query({
                type: monitor.game,
                host: host,
                port: monitor.port,
                givenPortOnly: Boolean(monitor.gamedigGivenPortOnly),
            });

            heartbeat.msg = state.name;
            heartbeat.status = UP;
            heartbeat.ping = state.ping;
        } catch (e) {
            throw new Error(e.message);
        }
    }

    /**
     * Resolves a domain name to its IPv4 address.
     * 
     * @param {string} hostname - The domain name to resolve (e.g., "example.dyndns.org").
     * @returns {Promise<string>} - The resolved IP address.
     * @throws Will throw an error if the DNS resolution fails.
     */
    async resolveHostname(hostname) {
        try {
            const result = await dns.lookup(hostname);
            return result.address;
        } catch (err) {
            throw new Error(`DNS resolution failed for ${hostname}: ${err.message}`);
        }
    }
}

module.exports = {
    GameDigMonitorType,
};
