const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING } = require("../src/util");
const { LimitQueue } = require("./utils/limit-queue");
const { log } = require("../src/util");

/**
 * Calculates the uptime of a monitor.
 */
class UptimeCalculator {

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
    }

    /**
     * @param {number} status status
     * @returns {dayjs.Dayjs} date
     * @throws {Error} Invalid status
     */
    update(status) {
        let date = this.getCurrentDate();
        let flatStatus = this.flatStatus(status);
        let divisionKey = this.getDivisionKey(date);
        let dailyKey = this.getDailyKey(divisionKey);

        if (flatStatus === UP) {
            this.uptimeDataList[divisionKey].up += 1;
            this.dailyUptimeDataList[dailyKey].up += 1;
        } else {
            this.uptimeDataList[divisionKey].down += 1;
            this.dailyUptimeDataList[dailyKey].down += 1;
        }

        this.lastDailyUptimeData = this.dailyUptimeDataList[dailyKey];

        this.clear();
        return date;
    }

    /**
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {number} division
     */
    getDivisionKey(date) {
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
            });
        }

        return divisionKey;
    }

    /**
     * Convert timestamp to daily key
     * @param {number} timestamp Timestamp
     * @returns {number} dailyKey
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
     *
     */
    get24HourUptime() {
        let dailyKey = this.getDailyKey(this.getCurrentDate().unix());
        let dailyUptimeData = this.dailyUptimeDataList[dailyKey];

        // No data in last 24 hours, it could be a new monitor or the interval is larger than 24 hours
        // Try to use previous data, if no previous data, return 0
        if (dailyUptimeData.up === 0 && dailyUptimeData.down === 0) {
            if (this.lastDailyUptimeData) {
                dailyUptimeData = this.lastDailyUptimeData;
            } else {
                return 0;
            }
        }

        return dailyUptimeData.up / (dailyUptimeData.up + dailyUptimeData.down);
    }

    /**
     * @param day
     */
    getUptime(day) {
        let dailyKey = this.getDailyKey(this.getCurrentDate().unix());

        let total = {
            up: 0,
            down: 0,
        };

        for (let i = 0; i < day; i++) {
            let dailyUptimeData = this.dailyUptimeDataList[dailyKey];

            if (dailyUptimeData) {
                total.up += dailyUptimeData.up;
                total.down += dailyUptimeData.down;
            }

            // Previous day
            dailyKey -= 86400;
        }

        if (total.up === 0 && total.down === 0) {
            if (this.lastDailyUptimeData) {
                total = this.lastDailyUptimeData;
            } else {
                return 0;
            }
        }

        return total.up / (total.up + total.down);
    }

    /**
     *
     */
    get7DayUptime() {
        return this.getUptime(7);
    }

    /**
     *
     */
    get30DayUptime() {
        return this.getUptime(30);
    }

    /**
     *
     */
    get1YearUptime() {
        return this.getUptime(365);
    }

    /**
     *
     */
    getCurrentDate() {
        return dayjs.utc();
    }

    /**
     * TODO
     */
    clear() {
        // Clear data older than 24 hours

        // Clear data older than 1 year

        // https://stackoverflow.com/a/6630869/1097815
    }
}

module.exports = {
    UptimeCalculator
};
