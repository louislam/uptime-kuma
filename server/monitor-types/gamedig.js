const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { GameDig } = require("gamedig");
const dns = require("dns").promises;
const net = require("net");

class GameDigMonitorType extends MonitorType {
    name = "gamedig";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        let host = monitor.hostname;
        if (net.isIP(host) === 0) {
            host = await this.resolveHostname(host);
        }

        try {
            const state = await GameDig.query({
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
