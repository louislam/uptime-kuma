const { checkLogin } = require("../util");
const { UptimeCalculator } = require("../uptime-calculator");
const Database = require("../database");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const { DOWN, MAINTENANCE, PENDING, UP, SQL_DATETIME_FORMAT, log } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));

/**
 * Get chart buckets for an informational monitor without writing uptime statistics.
 * @param {number} monitorID Monitor id
 * @param {number} period Period in hours
 * @returns {Promise<object[]>} Chart datapoints
 */
async function getInformationalChartData(monitorID, period) {
    let bucketCount;
    let bucketSeconds;
    let dateUnit;

    if (period <= 24) {
        bucketCount = period * 60;
        bucketSeconds = 60;
        dateUnit = "minute";
    } else if (period <= 720) {
        bucketCount = period;
        bucketSeconds = 3600;
        dateUnit = "hour";
    } else {
        bucketCount = Math.ceil(period / 24);
        bucketSeconds = 86400;
        dateUnit = "day";
    }

    if (!Number.isFinite(bucketCount) || bucketCount <= 0) {
        throw new Error("Invalid period.");
    }

    const startTime = dayjs
        .utc()
        .startOf(dateUnit)
        .subtract(bucketCount - 1, dateUnit)
        .format(SQL_DATETIME_FORMAT);
    const timestampExpression =
        Database.dbConfig.type === "sqlite" ? "CAST(strftime('%s', time) AS INTEGER)" : "UNIX_TIMESTAMP(time)";
    const bucketExpression = `(${timestampExpression} - (${timestampExpression} % ${bucketSeconds}))`;

    const rows = await R.getAll(
        `
            SELECT ${bucketExpression} AS bucket_timestamp,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS up,
                SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) AS down,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS maintenance,
                AVG(CASE WHEN status = ? THEN ping END) AS avgPing,
                MIN(CASE WHEN status = ? THEN ping END) AS minPing,
                MAX(CASE WHEN status = ? THEN ping END) AS maxPing
            FROM heartbeat
            WHERE monitor_id = ? AND time >= ?
            GROUP BY bucket_timestamp
            ORDER BY bucket_timestamp
        `,
        [UP, DOWN, PENDING, MAINTENANCE, UP, UP, UP, monitorID, startTime]
    );

    return rows.map((row) => ({
        timestamp: Number(row.bucket_timestamp),
        up: Number(row.up),
        down: Number(row.down),
        maintenance: Number(row.maintenance) || undefined,
        avgPing: row.avgPing == null ? null : Number(row.avgPing),
        minPing: row.minPing == null ? null : Number(row.minPing),
        maxPing: row.maxPing == null ? null : Number(row.maxPing),
    }));
}

module.exports.getInformationalChartData = getInformationalChartData;

module.exports.chartSocketHandler = (socket) => {
    socket.on("getMonitorChartData", async (monitorID, period, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Monitor Chart Data: ${monitorID} User ID: ${socket.userID}`);

            if (period == null) {
                throw new Error("Invalid period.");
            }

            let data;
            const monitor = await R.findOne("monitor", "id = ?", [monitorID]);
            if (monitor?.isInformational()) {
                data = await getInformationalChartData(monitorID, Number(period));
            } else {
                let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);
                await uptimeCalculator.ensureHistoryLoaded();

                if (period <= 24) {
                    data = uptimeCalculator.getDataArray(period * 60, "minute");
                } else if (period <= 720) {
                    data = uptimeCalculator.getDataArray(period, "hour");
                } else {
                    data = uptimeCalculator.getDataArray(period / 24, "day");
                }
            }

            callback({
                ok: true,
                data,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
