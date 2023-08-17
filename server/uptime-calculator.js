const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING } = require("../src/util");
const { LimitQueue } = require("./utils/limit-queue");
const { log } = require("../src/util");
const { R } = require("redbean-node");

/**
 * Calculates the uptime of a monitor.
 */
class UptimeCalculator {

    flushInterval = 60 * 1000;

    /**
     * For testing purposes, we can set the current date to a specific date.
     * @type {dayjs.Dayjs}
     */
    static currentDate = null;

    monitorID;

    /**
     * Recent 24-hour uptime, each item is a 1-minute interval
     * Key: {number} DivisionKey
     */
    uptimeDataList = new LimitQueue(24 * 60);

    /**
     * Daily uptime data,
     * Key: {number} DailyKey
     */
    dailyUptimeDataList = new LimitQueue(365);

    lastDailyUptimeData = null;
    lastUptimeData = null;

    /**
     *
     */
    constructor() {
        if (process.env.TEST_BACKEND) {
            // Override the getCurrentDate() method to return a specific date
            // Only for testing
            this.getCurrentDate = () => {
                if (UptimeCalculator.currentDate) {
                    return UptimeCalculator.currentDate;
                } else {
                    return dayjs.utc();
                }
            };
        }
    }

    /**
     * @param {number} monitorID
     */
    async init(monitorID) {
        this.monitorID = monitorID;

        // Object.assign(new Foo, { a: 1 })
    }

    /**
     * @param {number} status status
     * @param {number} ping
     * @returns {dayjs.Dayjs} date
     * @throws {Error} Invalid status
     */
    update(status, ping = 0) {
        let date = this.getCurrentDate();
        let flatStatus = this.flatStatus(status);
        let divisionKey = this.getMinutelyKey(date);
        let dailyKey = this.getDailyKey(divisionKey);

        if (flatStatus === UP) {
            this.uptimeDataList[divisionKey].up += 1;
            this.dailyUptimeDataList[dailyKey].up += 1;
        } else {
            this.uptimeDataList[divisionKey].down += 1;
            this.dailyUptimeDataList[dailyKey].down += 1;
        }

        // Add avg ping
        let count = this.uptimeDataList[divisionKey].up + this.uptimeDataList[divisionKey].down;
        this.uptimeDataList[divisionKey].ping = (this.uptimeDataList[divisionKey].ping * (count - 1) + ping) / count;

        // Add avg ping (daily)
        count = this.dailyUptimeDataList[dailyKey].up + this.dailyUptimeDataList[dailyKey].down;
        this.dailyUptimeDataList[dailyKey].ping = (this.dailyUptimeDataList[dailyKey].ping * (count - 1) + ping) / count;

        if (this.dailyUptimeDataList[dailyKey] != this.lastDailyUptimeData) {

            this.lastDailyUptimeData =
            this.lastDailyUptimeData.monitor_id = this.monitorID;
            this.lastDailyUptimeData.timestamp = dailyKey;
            this.lastDailyUptimeData = this.dailyUptimeDataList[dailyKey];
        }

        if (this.uptimeDataList[divisionKey] != this.lastUptimeData) {
            this.lastUptimeData = this.uptimeDataList[divisionKey];
        }

        return date;
    }

    /**
     * Get the daily stat bean
     * @param {number} timestamp milliseconds
     * @returns {Promise<import("redbean-node").Bean>} stat_daily bean
     */
    async getDailyStatBean(timestamp) {
        let bean = await R.findOne("stat_daily", " monitor_id = ? AND timestamp = ?", [
            this.monitorID,
            timestamp,
        ]);

        if (!bean) {
            bean = R.dispense("stat_daily");
            bean.monitor_id = this.monitorID;
            bean.timestamp = timestamp;
        }
        return bean;
    }

    /**
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {number} Timestamp
     */
    getMinutelyKey(date) {
        // Convert the current date to the nearest minute (e.g. 2021-01-01 12:34:56 -> 2021-01-01 12:34:00)
        date = date.startOf("minute");

        // Convert to timestamp in second
        let divisionKey = date.unix();

        if (! (divisionKey in this.uptimeDataList)) {
            let last = this.uptimeDataList.getLastKey();
            if (last && last > divisionKey) {
                log.warn("uptime-calc", "The system time has been changed? The uptime data may be inaccurate.");
            }

            this.uptimeDataList.push(divisionKey, {
                up: 0,
                down: 0,
                ping: 0,
            });
        }

        return divisionKey;
    }

    /**
     * Convert timestamp to daily key
     * @param {number} timestamp Timestamp
     * @returns {number} Timestamp
     */
    getDailyKey(timestamp) {
        let date = dayjs.unix(timestamp);

        // Convert the date to the nearest day (e.g. 2021-01-01 12:34:56 -> 2021-01-01 00:00:00)
        // Considering if the user keep changing could affect the calculation, so use UTC time to avoid this problem.
        date = date.utc().startOf("day");
        let dailyKey = date.unix();

        if (!this.dailyUptimeDataList[dailyKey]) {
            let last = this.dailyUptimeDataList.getLastKey();
            if (last && last > dailyKey) {
                log.warn("uptime-calc", "The system time has been changed? The uptime data may be inaccurate.");
            }

            this.dailyUptimeDataList.push(dailyKey, {
                up: 0,
                down: 0,
                ping: 0,
            });
        }

        return dailyKey;
    }

    /**
     * Flat status to UP or DOWN
     * @param {number} status
     * @returns {number}
     * @throws {Error} Invalid status
     */
    flatStatus(status) {
        switch (status) {
            case UP:
            case MAINTENANCE:
                return UP;
            case DOWN:
            case PENDING:
                return DOWN;
        }
        throw new Error("Invalid status");
    }

    /**
     * @param {number} num
     * @param {string} type "day" | "minute"
     */
    getData(num, type = "day") {
        let key;

        if (type === "day") {
            key = this.getDailyKey(this.getCurrentDate().unix());
        } else {
            if (num > 24 * 60) {
                throw new Error("The maximum number of minutes is 1440");
            }
            key = this.getMinutelyKey(this.getCurrentDate());
        }

        let total = {
            up: 0,
            down: 0,
        };

        let totalPing = 0;

        for (let i = 0; i < num; i++) {
            let data;

            if (type === "day") {
                data = this.dailyUptimeDataList[key];
            } else {
                data = this.uptimeDataList[key];
            }

            if (data) {
                total.up += data.up;
                total.down += data.down;
                totalPing += data.ping;
            }

            // Previous day
            if (type === "day") {
                key -= 86400;
            } else {
                key -= 60;
            }
        }

        if (total.up === 0 && total.down === 0) {
            if (type === "day" && this.lastDailyUptimeData) {
                total = this.lastDailyUptimeData;
            } else if (type === "minute" && this.lastUptimeData) {
                total = this.lastUptimeData;
            } else {
                return {
                    uptime: 0,
                    avgPing: 0,
                };
            }
        }

        return {
            uptime: total.up / (total.up + total.down),
            avgPing: totalPing / total.up,
        };
    }

    /**
     *
     */
    get24Hour() {
        return this.getData(24, "minute");
    }

    /**
     *
     */
    get7Day() {
        return this.getData(7);
    }

    /**
     *
     */
    get30Day() {
        return this.getData(30);
    }

    /**
     *
     */
    get1Year() {
        return this.getData(365);
    }

    /**
     *
     */
    getCurrentDate() {
        return dayjs.utc();
    }

}

module.exports = {
    UptimeCalculator
};
