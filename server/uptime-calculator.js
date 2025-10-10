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
     * Recent 30-day uptime, each item is a 1-hour interval
     * Key: {number} DivisionKey
     * @type {LimitQueue<number,string>}
     */
    hourlyUptimeDataList = new LimitQueue(30 * 24);

    /**
     * Daily uptime data,
     * Key: {number} DailyKey
     */
    dailyUptimeDataList = new LimitQueue(365);

    lastUptimeData = null;
    lastHourlyUptimeData = null;
    lastDailyUptimeData = null;

    lastDailyStatBean = null;
    lastHourlyStatBean = null;
    lastMinutelyStatBean = null;

    /**
     * For migration purposes.
     * @type {boolean}
     */
    migrationMode = false;

    statMinutelyKeepHour = 24;
    statHourlyKeepDay = 30;

    /**
     * Get the uptime calculator for a monitor
     * Initializes and returns the monitor if it does not exist
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<UptimeCalculator>} UptimeCalculator
     */
    static async getUptimeCalculator(monitorID) {
        if (!monitorID) {
            throw new Error("Monitor ID is required");
        }

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
            let data = {
                up: bean.up,
                down: bean.down,
                avgPing: bean.ping,
                minPing: bean.pingMin,
                maxPing: bean.pingMax,
            };

            if (bean.extras != null) {
                data = {
                    ...data,
                    ...JSON.parse(bean.extras),
                };
            }

            let key = bean.timestamp;
            this.minutelyUptimeDataList.push(key, data);
        }

        // Load hourly data from database (recent 30 days only)
        let hourlyStatBeans = await R.find("stat_hourly", " monitor_id = ? AND timestamp > ? ORDER BY timestamp", [
            monitorID,
            this.getHourlyKey(now.subtract(30, "day")),
        ]);

        for (let bean of hourlyStatBeans) {
            let data = {
                up: bean.up,
                down: bean.down,
                avgPing: bean.ping,
                minPing: bean.pingMin,
                maxPing: bean.pingMax,
            };

            if (bean.extras != null) {
                data = {
                    ...data,
                    ...JSON.parse(bean.extras),
                };
            }

            this.hourlyUptimeDataList.push(bean.timestamp, data);
        }

        // Load daily data from database (recent 365 days only)
        let dailyStatBeans = await R.find("stat_daily", " monitor_id = ? AND timestamp > ? ORDER BY timestamp", [
            monitorID,
            this.getDailyKey(now.subtract(365, "day")),
        ]);

        for (let bean of dailyStatBeans) {
            let data = {
                up: bean.up,
                down: bean.down,
                avgPing: bean.ping,
                minPing: bean.pingMin,
                maxPing: bean.pingMax,
            };

            if (bean.extras != null) {
                data = {
                    ...data,
                    ...JSON.parse(bean.extras),
                };
            }

            this.dailyUptimeDataList.push(bean.timestamp, data);
        }
    }

    /**
     * @param {number} status status
     * @param {number} ping Ping
     * @param {dayjs.Dayjs} date Date (Only for migration)
     * @returns {dayjs.Dayjs} date
     * @throws {Error} Invalid status
     */
    async update(status, ping = 0, date) {
        if (!date) {
            date = this.getCurrentDate();
        }

        let flatStatus = this.flatStatus(status);

        if (flatStatus === DOWN && ping > 0) {
            log.debug("uptime-calc", "The ping is not effective when the status is DOWN");
        }

        let divisionKey = this.getMinutelyKey(date);
        let hourlyKey = this.getHourlyKey(date);
        let dailyKey = this.getDailyKey(date);

        let minutelyData = this.minutelyUptimeDataList[divisionKey];
        let hourlyData = this.hourlyUptimeDataList[hourlyKey];
        let dailyData = this.dailyUptimeDataList[dailyKey];

        if (status === MAINTENANCE) {
            minutelyData.maintenance = minutelyData.maintenance ? minutelyData.maintenance + 1 : 1;
            hourlyData.maintenance = hourlyData.maintenance ? hourlyData.maintenance + 1 : 1;
            dailyData.maintenance = dailyData.maintenance ? dailyData.maintenance + 1 : 1;

        } else if (flatStatus === UP) {
            minutelyData.up += 1;
            hourlyData.up += 1;
            dailyData.up += 1;

            // Only UP status can update the ping
            if (!isNaN(ping)) {
                // Add avg ping
                // The first beat of the minute, the ping is the current ping
                if (minutelyData.up === 1) {
                    minutelyData.avgPing = ping;
                    minutelyData.minPing = ping;
                    minutelyData.maxPing = ping;
                } else {
                    minutelyData.avgPing = (minutelyData.avgPing * (minutelyData.up - 1) + ping) / minutelyData.up;
                    minutelyData.minPing = Math.min(minutelyData.minPing, ping);
                    minutelyData.maxPing = Math.max(minutelyData.maxPing, ping);
                }

                // Add avg ping
                // The first beat of the hour, the ping is the current ping
                if (hourlyData.up === 1) {
                    hourlyData.avgPing = ping;
                    hourlyData.minPing = ping;
                    hourlyData.maxPing = ping;
                } else {
                    hourlyData.avgPing = (hourlyData.avgPing * (hourlyData.up - 1) + ping) / hourlyData.up;
                    hourlyData.minPing = Math.min(hourlyData.minPing, ping);
                    hourlyData.maxPing = Math.max(hourlyData.maxPing, ping);
                }

                // Add avg ping (daily)
                // The first beat of the day, the ping is the current ping
                if (dailyData.up === 1) {
                    dailyData.avgPing = ping;
                    dailyData.minPing = ping;
                    dailyData.maxPing = ping;
                } else {
                    dailyData.avgPing = (dailyData.avgPing * (dailyData.up - 1) + ping) / dailyData.up;
                    dailyData.minPing = Math.min(dailyData.minPing, ping);
                    dailyData.maxPing = Math.max(dailyData.maxPing, ping);
                }
            }

        } else if (flatStatus === DOWN) {
            minutelyData.down += 1;
            hourlyData.down += 1;
            dailyData.down += 1;
        }

        if (minutelyData !== this.lastUptimeData) {
            this.lastUptimeData = minutelyData;
        }

        if (hourlyData !== this.lastHourlyUptimeData) {
            this.lastHourlyUptimeData = hourlyData;
        }

        if (dailyData !== this.lastDailyUptimeData) {
            this.lastDailyUptimeData = dailyData;
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
        dailyStatBean.pingMin = dailyData.minPing;
        dailyStatBean.pingMax = dailyData.maxPing;
        {
            // eslint-disable-next-line no-unused-vars
            const { up, down, avgPing, minPing, maxPing, timestamp, ...extras } = dailyData;
            if (Object.keys(extras).length > 0) {
                dailyStatBean.extras = JSON.stringify(extras);
            }
        }
        await R.store(dailyStatBean);

        let currentDate = this.getCurrentDate();

        // For migration mode, we don't need to store old hourly and minutely data, but we need 30-day's hourly data
        // Run anyway for non-migration mode
        if (!this.migrationMode || date.isAfter(currentDate.subtract(this.statHourlyKeepDay, "day"))) {
            let hourlyStatBean = await this.getHourlyStatBean(hourlyKey);
            hourlyStatBean.up = hourlyData.up;
            hourlyStatBean.down = hourlyData.down;
            hourlyStatBean.ping = hourlyData.avgPing;
            hourlyStatBean.pingMin = hourlyData.minPing;
            hourlyStatBean.pingMax = hourlyData.maxPing;
            {
                // eslint-disable-next-line no-unused-vars
                const { up, down, avgPing, minPing, maxPing, timestamp, ...extras } = hourlyData;
                if (Object.keys(extras).length > 0) {
                    hourlyStatBean.extras = JSON.stringify(extras);
                }
            }
            await R.store(hourlyStatBean);
        }

        // For migration mode, we don't need to store old hourly and minutely data, but we need 24-hour's minutely data
        // Run anyway for non-migration mode
        if (!this.migrationMode || date.isAfter(currentDate.subtract(this.statMinutelyKeepHour, "hour"))) {
            let minutelyStatBean = await this.getMinutelyStatBean(divisionKey);
            minutelyStatBean.up = minutelyData.up;
            minutelyStatBean.down = minutelyData.down;
            minutelyStatBean.ping = minutelyData.avgPing;
            minutelyStatBean.pingMin = minutelyData.minPing;
            minutelyStatBean.pingMax = minutelyData.maxPing;
            {
                // eslint-disable-next-line no-unused-vars
                const { up, down, avgPing, minPing, maxPing, timestamp, ...extras } = minutelyData;
                if (Object.keys(extras).length > 0) {
                    minutelyStatBean.extras = JSON.stringify(extras);
                }
            }
            await R.store(minutelyStatBean);
        }

        // No need to remove old data in migration mode
        if (!this.migrationMode) {
            // Remove the old data
            // TODO: Improvement: Convert it to a job?
            log.debug("uptime-calc", "Remove old data");
            await R.exec("DELETE FROM stat_minutely WHERE monitor_id = ? AND timestamp < ?", [
                this.monitorID,
                this.getMinutelyKey(currentDate.subtract(this.statMinutelyKeepHour, "hour")),
            ]);

            await R.exec("DELETE FROM stat_hourly WHERE monitor_id = ? AND timestamp < ?", [
                this.monitorID,
                this.getHourlyKey(currentDate.subtract(this.statHourlyKeepDay, "day")),
            ]);
        }

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
     * Get the hourly stat bean
     * @param {number} timestamp milliseconds
     * @returns {Promise<import("redbean-node").Bean>} stat_hourly bean
     */
    async getHourlyStatBean(timestamp) {
        if (this.lastHourlyStatBean && this.lastHourlyStatBean.timestamp === timestamp) {
            return this.lastHourlyStatBean;
        }

        let bean = await R.findOne("stat_hourly", " monitor_id = ? AND timestamp = ?", [
            this.monitorID,
            timestamp,
        ]);

        if (!bean) {
            bean = R.dispense("stat_hourly");
            bean.monitor_id = this.monitorID;
            bean.timestamp = timestamp;
        }

        this.lastHourlyStatBean = bean;
        return this.lastHourlyStatBean;
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
     * Convert timestamp to minutely key
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {number} Timestamp
     */
    getMinutelyKey(date) {
        // Truncate value to minutes (e.g. 2021-01-01 12:34:56 -> 2021-01-01 12:34:00)
        date = date.startOf("minute");

        // Convert to timestamp in second
        let divisionKey = date.unix();

        if (! (divisionKey in this.minutelyUptimeDataList)) {
            this.minutelyUptimeDataList.push(divisionKey, {
                up: 0,
                down: 0,
                avgPing: 0,
                minPing: 0,
                maxPing: 0,
            });
        }

        return divisionKey;
    }

    /**
     * Convert timestamp to hourly key
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {number} Timestamp
     */
    getHourlyKey(date) {
        // Truncate value to hours (e.g. 2021-01-01 12:34:56 -> 2021-01-01 12:00:00)
        date = date.startOf("hour");

        // Convert to timestamp in second
        let divisionKey = date.unix();

        if (! (divisionKey in this.hourlyUptimeDataList)) {
            this.hourlyUptimeDataList.push(divisionKey, {
                up: 0,
                down: 0,
                avgPing: 0,
                minPing: 0,
                maxPing: 0,
            });
        }

        return divisionKey;
    }

    /**
     * Convert timestamp to daily key
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {number} Timestamp
     */
    getDailyKey(date) {
        // Truncate value to start of day (e.g. 2021-01-01 12:34:56 -> 2021-01-01 00:00:00)
        // Considering if the user keep changing could affect the calculation, so use UTC time to avoid this problem.
        date = date.utc().startOf("day");
        let dailyKey = date.unix();

        if (!this.dailyUptimeDataList[dailyKey]) {
            this.dailyUptimeDataList.push(dailyKey, {
                up: 0,
                down: 0,
                avgPing: 0,
                minPing: 0,
                maxPing: 0,
            });
        }

        return dailyKey;
    }

    /**
     * Convert timestamp to key
     * @param {dayjs.Dayjs} datetime Datetime
     * @param {"day" | "hour" | "minute"} type the type of data which is expected to be returned
     * @returns {number} Timestamp
     * @throws {Error} If the type is invalid
     */
    getKey(datetime, type) {
        switch (type) {
            case "day":
                return this.getDailyKey(datetime);
            case "hour":
                return this.getHourlyKey(datetime);
            case "minute":
                return this.getMinutelyKey(datetime);
            default:
                throw new Error("Invalid type");
        }
    }

    /**
     * Flat status to UP or DOWN
     * @param {number} status the status which should be turned into a flat status
     * @returns {UP|DOWN|PENDING} The flat status
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
     * @param {number} num the number of data points which are expected to be returned
     * @param {"day" | "hour" | "minute"} type the type of data which is expected to be returned
     * @returns {UptimeDataResult} UptimeDataResult
     * @throws {Error} The maximum number of minutes greater than 1440
     */
    getData(num, type = "day") {

        if (type === "hour" && num > 24 * 30) {
            throw new Error("The maximum number of hours is 720");
        }
        if (type === "minute" && num > 24 * 60) {
            throw new Error("The maximum number of minutes is 1440");
        }
        if (type === "day" && num > 365) {
            throw new Error("The maximum number of days is 365");
        }
        // Get the current time period key based on the type
        let key = this.getKey(this.getCurrentDate(), type);

        let total = {
            up: 0,
            down: 0,
        };

        let totalPing = 0;
        let endTimestamp;

        // Get the earliest timestamp of the required period based on the type
        switch (type) {
            case "day":
                endTimestamp = key - 86400 * (num - 1);
                break;
            case "hour":
                endTimestamp = key - 3600 * (num - 1);
                break;
            case "minute":
                endTimestamp = key - 60 * (num - 1);
                break;
            default:
                throw new Error("Invalid type");
        }

        // Sum up all data in the specified time range
        while (key >= endTimestamp) {
            let data;

            switch (type) {
                case "day":
                    data = this.dailyUptimeDataList[key];
                    break;
                case "hour":
                    data = this.hourlyUptimeDataList[key];
                    break;
                case "minute":
                    data = this.minutelyUptimeDataList[key];
                    break;
                default:
                    throw new Error("Invalid type");
            }

            if (data) {
                total.up += data.up;
                total.down += data.down;
                totalPing += data.avgPing * data.up;
            }

            // Set key to the previous time period
            switch (type) {
                case "day":
                    key -= 86400;
                    break;
                case "hour":
                    key -= 3600;
                    break;
                case "minute":
                    key -= 60;
                    break;
                default:
                    throw new Error("Invalid type");
            }
        }

        let uptimeData = new UptimeDataResult();

        // If there is no data in the previous time ranges, use the last data?
        if (total.up === 0 && total.down === 0) {
            switch (type) {
                case "day":
                    if (this.lastDailyUptimeData) {
                        total = this.lastDailyUptimeData;
                        totalPing = total.avgPing * total.up;
                    } else {
                        return uptimeData;
                    }
                    break;
                case "hour":
                    if (this.lastHourlyUptimeData) {
                        total = this.lastHourlyUptimeData;
                        totalPing = total.avgPing * total.up;
                    } else {
                        return uptimeData;
                    }
                    break;
                case "minute":
                    if (this.lastUptimeData) {
                        total = this.lastUptimeData;
                        totalPing = total.avgPing * total.up;
                    } else {
                        return uptimeData;
                    }
                    break;
                default:
                    throw new Error("Invalid type");
            }
        }

        let avgPing;

        if (total.up === 0) {
            avgPing = null;
        } else {
            avgPing = totalPing / total.up;
        }

        if (total.up + total.down === 0) {
            uptimeData.uptime = 0;
        } else {
            uptimeData.uptime = total.up / (total.up + total.down);
        }
        uptimeData.avgPing = avgPing;
        return uptimeData;
    }

    /**
     * Get data in form of an array
     * @param {number} num the number of data points which are expected to be returned
     * @param {"day" | "hour" | "minute"} type the type of data which is expected to be returned
     * @returns {Array<object>} uptime data
     * @throws {Error} The maximum number of minutes greater than 1440
     */
    getDataArray(num, type = "day") {
        if (type === "hour" && num > 24 * 30) {
            throw new Error("The maximum number of hours is 720");
        }
        if (type === "minute" && num > 24 * 60) {
            throw new Error("The maximum number of minutes is 1440");
        }

        // Get the current time period key based on the type
        let key = this.getKey(this.getCurrentDate(), type);

        let result = [];

        let endTimestamp;

        // Get the earliest timestamp of the required period based on the type
        switch (type) {
            case "day":
                endTimestamp = key - 86400 * (num - 1);
                break;
            case "hour":
                endTimestamp = key - 3600 * (num - 1);
                break;
            case "minute":
                endTimestamp = key - 60 * (num - 1);
                break;
            default:
                throw new Error("Invalid type");
        }

        // Get datapoints in the specified time range
        while (key >= endTimestamp) {
            let data;

            switch (type) {
                case "day":
                    data = this.dailyUptimeDataList[key];
                    break;
                case "hour":
                    data = this.hourlyUptimeDataList[key];
                    break;
                case "minute":
                    data = this.minutelyUptimeDataList[key];
                    break;
                default:
                    throw new Error("Invalid type");
            }

            if (data) {
                data.timestamp = key;
                result.push(data);
            }

            // Set key to the previous time period
            switch (type) {
                case "day":
                    key -= 86400;
                    break;
                case "hour":
                    key -= 3600;
                    break;
                case "minute":
                    key -= 60;
                    break;
                default:
                    throw new Error("Invalid type");
            }
        }

        return result;
    }

    /**
     * Get the uptime data for given duration.
     * @param {string} duration  A string with a number and a unit (m,h,d,w,M,y), such as 24h, 30d, 1y.
     * @returns {UptimeDataResult} UptimeDataResult
     * @throws {Error} Invalid duration / Unsupported unit
     */
    getDataByDuration(duration) {
        const durationNumStr = duration.slice(0, -1);

        if (!/^[0-9]+$/.test(durationNumStr)) {
            throw new Error(`Invalid duration: ${duration}`);
        }
        const num = Number(durationNumStr);
        const unit = duration.slice(-1);

        switch (unit) {
            case "m":
                return this.getData(num, "minute");
            case "h":
                return this.getData(num, "hour");
            case "d":
                return this.getData(num, "day");
            case "w":
                return this.getData(7 * num, "day");
            case "M":
                return this.getData(30 * num, "day");
            case "y":
                return this.getData(365 * num, "day");
            default:
                throw new Error(`Unsupported unit (${unit}) for badge duration ${duration}`
                );
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
        return this.getData(168, "hour");
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
     * @returns {dayjs.Dayjs} Current datetime in UTC
     */
    getCurrentDate() {
        return dayjs.utc();
    }

    /**
     * For migration purposes.
     * @param {boolean} value Migration mode on/off
     * @returns {void}
     */
    setMigrationMode(value) {
        this.migrationMode = value;
    }
}

class UptimeDataResult {
    /**
     * @type {number} Uptime
     */
    uptime = 0;

    /**
     * @type {number} Average ping
     */
    avgPing = null;
}

module.exports = {
    UptimeCalculator,
    UptimeDataResult,
};
