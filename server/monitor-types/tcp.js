const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const tcpp = require("tcp-ping");

/**
 * Send TCP request to specified hostname and port
 * @param {string} hostname Hostname / address of machine
 * @param {number} port TCP port to test
 * @returns {Promise<number>} Maximum time in ms rounded to nearest integer
 */
const tcping = (hostname, port) => {
    return new Promise((resolve, reject) => {
        tcpp.ping(
            {
                address: hostname,
                port: port,
                attempts: 1,
            },
            (err, data) => {
                if (err) {
                    reject(err);
                }

                if (data.results.length >= 1 && data.results[0].err) {
                    reject(data.results[0].err);
                }

                resolve(Math.round(data.max));
            }
        );
    });
};

class TCPMonitorType extends MonitorType {
    name = "port";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        try {
            const resp = await tcping(monitor.hostname, monitor.port);
            heartbeat.ping = resp;
            heartbeat.msg = `${resp} ms`;
            heartbeat.status = UP;
        } catch {
            throw new Error("Connection failed");
        }
    }
}

module.exports = {
    TCPMonitorType,
};
