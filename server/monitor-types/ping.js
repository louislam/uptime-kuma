const { MonitorType } = require("./monitor-type");
const {
    log,
    UP,
    PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
} = require("../../src/util");
const { convertToUTF8 } = require("../util-server");
const pingLib = require("../modules/ping");

const isWindows = process.platform === /^win/.test(process.platform);

/**
 * Ping the specified machine
 * @param {string} destAddr Hostname / IP address of machine to ping
 * @param {number} count Number of packets to send before stopping
 * @param {string} sourceAddr Source address for sending/receiving echo requests
 * @param {boolean} numeric If true, IP addresses will be output instead of symbolic hostnames
 * @param {number} size Size (in bytes) of echo request to send
 * @param {number} deadline Maximum time in seconds before ping stops, regardless of packets sent
 * @param {number} timeout Maximum time in seconds to wait for each response
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
async function ping(
    destAddr,
    count = PING_COUNT_DEFAULT,
    sourceAddr = "",
    numeric = true,
    size = PING_PACKET_SIZE_DEFAULT,
    deadline = PING_GLOBAL_TIMEOUT_DEFAULT,
    timeout = PING_PER_REQUEST_TIMEOUT_DEFAULT
) {
    try {
        return await pingAsync(destAddr, false, count, sourceAddr, numeric, size, deadline, timeout);
    } catch (e) {
        // If the host cannot be resolved, try again with ipv6
        log.debug("ping", "IPv6 error message: " + e.message);

        // As node-ping does not report a specific error for this, try again if it is an empty message with ipv6 no matter what.
        if (!e.message) {
            return await pingAsync(destAddr, true, count, sourceAddr, numeric, size, deadline, timeout);
        } else {
            throw e;
        }
    }
}

/**
 * Ping the specified machine
 * @param {string} destAddr Hostname / IP address of machine to ping
 * @param {boolean} ipv6 Should IPv6 be used?
 * @param {number} count Number of packets to send before stopping
 * @param {string} sourceAddr Source address for sending/receiving echo requests
 * @param {boolean} numeric If true, IP addresses will be output instead of symbolic hostnames
 * @param {number} size Size (in bytes) of echo request to send
 * @param {number} deadline Maximum time in seconds before ping stops, regardless of packets sent
 * @param {number} timeout Maximum time in seconds to wait for each response
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
function pingAsync(
    destAddr,
    ipv6 = false,
    count = PING_COUNT_DEFAULT,
    sourceAddr = "",
    numeric = true,
    size = PING_PACKET_SIZE_DEFAULT,
    deadline = PING_GLOBAL_TIMEOUT_DEFAULT,
    timeout = PING_PER_REQUEST_TIMEOUT_DEFAULT
) {
    try {
        const url = new URL(`http://${destAddr}`);
        destAddr = url.hostname;
        if (destAddr.startsWith("[") && destAddr.endsWith("]")) {
            destAddr = destAddr.slice(1, -1);
        }
    } catch (e) {
        // ignore
    }

    return new Promise((resolve, reject) => {
        pingLib.promise
            .probe(destAddr, {
                v6: ipv6,
                min_reply: count,
                sourceAddr: sourceAddr,
                numeric: numeric,
                packetSize: size,
                deadline: deadline,
                timeout: timeout,
            })
            .then((res) => {
                // If ping failed, it will set field to unknown
                if (res.alive) {
                    resolve(res.time);
                } else {
                    if (isWindows) {
                        reject(new Error(convertToUTF8(res.output)));
                    } else {
                        reject(new Error(res.output));
                    }
                }
            })
            .catch((err) => {
                reject(err);
            });
    });
}

class PingMonitorType extends MonitorType {
    name = "ping";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        heartbeat.ping = await ping(
            monitor.hostname,
            monitor.ping_count,
            "",
            monitor.ping_numeric,
            monitor.packetSize,
            monitor.timeout,
            monitor.ping_per_request_timeout
        );
        heartbeat.msg = "";
        heartbeat.status = UP;
    }
}

module.exports = {
    PingMonitorType,
    ping,
    pingAsync,
};
