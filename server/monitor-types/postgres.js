const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const { postgresQuery } = require("../util-server");

class PostgresMonitorType extends MonitorType {
    name = "postgres";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();

        await postgresQuery(
            monitor.databaseConnectionString,
            monitor.databaseQuery || "SELECT 1"
        );

        heartbeat.msg = "";
        heartbeat.status = UP;
        heartbeat.ping = dayjs().valueOf() - startTime;
    }
}

module.exports = {
    PostgresMonitorType,
};
