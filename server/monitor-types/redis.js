const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const redis = require("redis");

class RedisMonitorType extends MonitorType {
    name = "redis";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        heartbeat.msg = await this.redisPingAsync(monitor.databaseConnectionString, !monitor.ignoreTls);
        heartbeat.status = UP;
    }

    /**
     * Redis server ping
     * @param {string} dsn The redis connection string
     * @param {boolean} rejectUnauthorized If false, allows unverified server certificates.
     * @returns {Promise<any>} Response from redis server
     */
    redisPingAsync(dsn, rejectUnauthorized) {
        return new Promise((resolve, reject) => {
            const client = redis.createClient({
                url: dsn,
                socket: {
                    rejectUnauthorized
                }
            });
            client.on("error", (err) => {
                if (client.isOpen) {
                    client.disconnect();
                }
                reject(err);
            });
            client.connect().then(() => {
                if (!client.isOpen) {
                    client.emit("error", new Error("connection isn't open"));
                }
                client.ping().then((res, err) => {
                    if (client.isOpen) {
                        client.disconnect();
                    }
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                }).catch(error => reject(error));
            });
        });
    }
}

module.exports = {
    RedisMonitorType,
};
