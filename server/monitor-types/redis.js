const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const redis = require("redis");

class RedisMonitorType extends MonitorType {
    name = "redis";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        heartbeat.msg = await this.redisPingAsync(monitor.databaseConnectionString);
        heartbeat.status = UP;
    }

    /**
     * Redis server ping
     * @param {string} dsn The redis connection string
     * @returns {Promise<any>} Response from redis server
     */
    async redisPingAsync(dsn) {
        const client = redis.createClient({
            url: dsn,
        });
        client.on("error", (err) => {
            if (client.isOpen) {
                client.disconnect();
            }
            throw err;
        });
        await client.connect();
        if (!client.isOpen) {
            throw new Error("connection isn't open after trying to connect");
        }
        const pingResult = client.ping();
        if (client.isOpen) {
            client.disconnect();
        }
        return pingResult;
    }
}

module.exports = {
    RedisMonitorType,
};
