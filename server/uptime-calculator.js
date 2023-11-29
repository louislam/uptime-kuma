const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING } = require("../src/util");
const { LimitQueue } = require("./utils/limit-queue");
const { log } = require("../src/util");
const { R } = require("redbean-node");

/**
 * Calculates the uptime of a monitor.
 */
class UptimeCalculator {
    /**
     * @private
     * @type {{string:UptimeCalculator}}
     */

    static list = {};

    /**
     * For testing purposes, we can set the current date to a specific date.
     * @type {dayjs.Dayjs}
     */
    static currentDate = null;

    /**
     * monitorID the id of the monitor
     * @type {number}
     */
    monitorID;

    /**
     * Recent 24-hour uptime, each item is a 1-minute interval
     * Key: {number} DivisionKey
     * @type {LimitQueue<number,string>}
     */
    minutelyUptimeDataList = new LimitQueue(24 * 60);

    /**
     * Daily uptime data,
     * Key: {number} DailyKey
     */
    dailyUptimeDataList = new LimitQueue(365);

    lastDailyUptimeData = null;
    lastUptimeData = null;

    lastDailyStatBean = null;
    lastMinutelyStatBean = null;

    /**
     * Get the uptime calculator for a monitor
     * Initializes and returns the monitor if it does not exist
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<UptimeCalculator>} UptimeCalculator
     */
    static async getUptimeCalculator(monitorID) {
        if (!UptimeCalculator.list[monitorID]) {
            UptimeCalculator.list[monitorID] = new UptimeCalculator();
            await UptimeCalculator.list[monitorID].init(monitorID);
        }
        return UptimeCalculator.list[monitorID];
    }

    /**
     * Remove a monitor from the list
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<void>}
     */
    static async remove(monitorID) {
        delete UptimeCalculator.list[monitorID];
    }

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
     * Initialize the uptime calculator for a monitor
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<void>}
     */
    async init(monitorID) {
        this.monitorID = monitorID;

        let now = this.getCurrentDate();

        // Load minutely data from database (recent 24 hours only)
        let minutelyStatBeans = await R.find("stat_minutely", " monitor_id = ? AND timestamp > ? ORDER BY timestamp", [
            monitorID,
            this.getMinutelyKey(now.subtract(24, "hour")),
        ]);

        for (let bean of minutelyStatBeans) {
            let key = bean.timestamp;
            this.minutelyUptimeDataList.push(key, {
                up: bean.up,
                down: bean.down,
                avgPing: bean.ping,
            });
        }

        // Load daily data from database (recent 365 days only)
        let dailyStatBeans = await R.find("stat_daily", " monitor_id = ? AND timestamp > ? ORDER BY timestamp", [
            monitorID,
            this.getDailyKey(now.subtract(365, "day").unix()),
        ]);

        for (let bean of dailyStatBeans) {
            let key = bean.timestamp;
            this.dailyUptimeDataList.push(key, {
                up: bean.up,
                down: bean.down,
                avgPing: bean.ping,
            });
        }
    }

    /**
     * @param {number} status status
     * @param {number} ping Ping
     * @returns {dayjs.Dayjs} date
     * @throws {Error} Invalid status
     */
    async update(status, ping = 0) {
        let date = this.getCurrentDate();

        // Don't count MAINTENANCE into uptime
        if (status === MAINTENANCE) {
            return date;
        }

        let flatStatus = this.flatStatus(status);

        if (flatStatus === DOWN && ping > 0) {
            log.warn("uptime-calc", "The ping is not effective when the status is DOWN");
        }

        let divisionKey = this.getMinutelyKey(date);
        let dailyKey = this.getDailyKey(divisionKey);

        let minutelyData = this.minutelyUptimeDataList[divisionKey];
        let dailyData = this.dailyUptimeDataList[dailyKey];

        if (flatStatus === UP) {
            minutelyData.up += 1;
            dailyData.up += 1;

            // Only UP status can update the ping
            if (!isNaN(ping)) {
                // Add avg ping
                // The first beat of the minute, the ping is the current ping
                if (minutelyData.up === 1) {
                    minutelyData.avgPing = ping;
                } else {
                    minutelyData.avgPing = (minutelyData.avgPing * (minutelyData.up - 1) + ping) / minutelyData.up;
                }

                // Add avg ping (daily)
                // The first beat of the day, the ping is the current ping
                if (minutelyData.up === 1) {
                    dailyData.avgPing = ping;
                } else {
                    dailyData.avgPing = (dailyData.avgPing * (dailyData.up - 1) + ping) / dailyData.up;
                }
            }

        } else {
            minutelyData.down += 1;
            dailyData.down += 1;
        }

        if (dailyData !== this.lastDailyUptimeData) {
            this.lastDailyUptimeData = dailyData;
        }

        if (minutelyData !== this.lastUptimeData) {
            this.lastUptimeData = minutelyData;
        }

        // Don't store data in test mode
        if (process.env.TEST_BACKEND) {
            log.debug("uptime-calc", "Skip storing data in test mode");
            return date;
        }

        let dailyStatBean = await this.getDailyStatBean(dailyKey);
        dailyStatBean.up = dailyData.up;
        dailyStatBean.down = dailyData.down;
        dailyStatBean.ping = dailyData.avgPing;
        await R.store(dailyStatBean);

        let minutelyStatBean = await this.getMinutelyStatBean(divisionKey);
        minutelyStatBean.up = minutelyData.up;
        minutelyStatBean.down = minutelyData.down;
        minutelyStatBean.ping = minutelyData.avgPing;
        await R.store(minutelyStatBean);

        // Remove the old data
        log.debug("uptime-calc", "Remove old data");
        await R.exec("DELETE FROM stat_minutely WHERE monitor_id = ? AND timestamp < ?", [
            this.monitorID,
            this.getMinutelyKey(date.subtract(24, "hour")),
        ]);

        return date;
    }

    /**
     * Get the daily stat bean
     * @param {number} timestamp milliseconds
     * @returns {Promise<import("redbean-node").Bean>} stat_daily bean
     */
    async getDailyStatBean(timestamp) {
        if (this.lastDailyStatBean && this.lastDailyStatBean.timestamp === timestamp) {
            return this.lastDailyStatBean;
        }

        let bean = await R.findOne("stat_daily", " monitor_id = ? AND timestamp = ?", [
            this.monitorID,
            timestamp,
        ]);

        if (!bean) {
            bean = R.dispense("stat_daily");
            bean.monitor_id = this.monitorID;
            bean.timestamp = timestamp;
        }

        this.lastDailyStatBean = bean;
        return this.lastDailyStatBean;
    }

    /**
     * Get the minutely stat bean
     * @param {number} timestamp milliseconds
     * @returns {Promise<import("redbean-node").Bean>} stat_minutely bean
     */
    async getMinutelyStatBean(timestamp) {
        if (this.lastMinutelyStatBean && this.lastMinutelyStatBean.timestamp === timestamp) {
            return this.lastMinutelyStatBean;
        }

        let bean = await R.findOne("stat_minutely", " monitor_id = ? AND timestamp = ?", [
            this.monitorID,
            timestamp,
        ]);

        if (!bean) {
            bean = R.dispense("stat_minutely");
            bean.monitor_id = this.monitorID;
            bean.timestamp = timestamp;
        }

        this.lastMinutelyStatBean = bean;
        return this.lastMinutelyStatBean;
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

        if (! (divisionKey in this.minutelyUptimeDataList)) {
            this.minutelyUptimeDataList.push(divisionKey, {
                up: 0,
                down: 0,
                avgPing: 0,
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
            this.dailyUptimeDataList.push(dailyKey, {
                up: 0,
                down: 0,
                avgPing: 0,
            });
        }

        return dailyKey;
    }

    /**
     * Flat status to UP or DOWN
     * @param {number} status the status which schould be turned into a flat status
     * @returns {UP|DOWN|PENDING} The flat status
     * @throws {Error} Invalid status
     */
    flatStatus(status) {
        switch (status) {
            case UP:
            // case MAINTENANCE:
                return UP;
            case DOWN:
            case PENDING:
                return DOWN;
        }
        throw new Error("Invalid status");
    }

    /**
     * @param {number} num the number of data points which are expected to be returned
     * @param {"day" | "minute"} type the type of data which is expected to be returned
     * @returns {UptimeDataResult} UptimeDataResult
     * @throws {Error} The maximum number of minutes greater than 1440
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
        let endTimestamp;

        if (type === "day") {
            endTimestamp = key - 86400 * (num - 1);
        } else {
            endTimestamp = key - 60 * (num - 1);
        }

        // Sum up all data in the specified time range
        while (key >= endTimestamp) {
            let data;

            if (type === "day") {
                data = this.dailyUptimeDataList[key];
            } else {
                data = this.minutelyUptimeDataList[key];
            }

            if (data) {
                total.up += data.up;
                total.down += data.down;
                totalPing += data.avgPing * data.up;
            }

            // Previous day
            if (type === "day") {
                key -= 86400;
            } else {
                key -= 60;
            }
        }

        let uptimeData = new UptimeDataResult();

        if (total.up === 0 && total.down === 0) {
            if (type === "day" && this.lastDailyUptimeData) {
                total = this.lastDailyUptimeData;
                totalPing = total.avgPing * total.up;
            } else if (type === "minute" && this.lastUptimeData) {
                total = this.lastUptimeData;
                totalPing = total.avgPing * total.up;
            } else {
                uptimeData.uptime = 0;
                uptimeData.avgPing = null;
                return uptimeData;
            }
        }

        let avgPing;

        if (total.up === 0) {
            avgPing = null;
        } else {
            avgPing = totalPing / total.up;
        }

        uptimeData.uptime = total.up / (total.up + total.down);
        uptimeData.avgPing = avgPing;
        return uptimeData;
    }

    /**
     * Get the uptime data by duration
     * @param {'24h'|'30d'|'1y'} duration Only accept 24h, 30d, 1y
     * @returns {UptimeDataResult} UptimeDataResult
     * @throws {Error} Invalid duration
     */
    getDataByDuration(duration) {
        if (duration === "24h") {
            return this.get24Hour();
        } else if (duration === "30d") {
            return this.get30Day();
        } else if (duration === "1y") {
            return this.get1Year();
        } else {
            throw new Error("Invalid duration");
        }
    }

    /**
     * 1440 = 24 * 60mins
     * @returns {UptimeDataResult} UptimeDataResult
     */
    get24Hour() {
        return this.getData(1440, "minute");
    }

    /**
     * @returns {UptimeDataResult} UptimeDataResult
     */
    get7Day() {
        return this.getData(7);
    }

    /**
     * @returns {UptimeDataResult} UptimeDataResult
     */
    get30Day() {
        return this.getData(30);
    }

    /**
     * @returns {UptimeDataResult} UptimeDataResult
     */
    get1Year() {
        return this.getData(365);
    }

    /**
     * @returns {dayjs.Dayjs} Current date
     */
    getCurrentDate() {
        return dayjs.utc();
    }

}

class UptimeDataResult {
    /**
     * @type {number} Uptime
     */
    uptime;

    /**
     * @type {number} Average ping
     */
    avgPing;
}

module.exports = {
    UptimeCalculator,
    UptimeDataResult,
};
