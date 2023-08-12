const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING } = require("../src/util");

/**
 * Calculates the uptime of a monitor.
 */
class UptimeCalculator {

    /**
     * For testing purposes, we can set the current date to a specific date.
     * @type {dayjs.Dayjs}
     */
    static currentDate = null;

    /**
     * Recent 24-hour uptime, each item is a 1-minute interval
     * Key: {number} DivisionKey
     */
    uptimeDataList = {

    };

    /**
     * Daily uptime data,
     * Key: {number} DailyKey
     */
    dailyUptimeDataList = {

    };

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
     * TODO
     */
    init() {
    }

    /**
     * @param {number} status status
     * @param {dayjs.Dayjs} date The heartbeat date
     * @returns {dayjs.Dayjs} date
     * @throws {Error} Invalid status
     */
    update(status) {
        let date = this.getCurrentDate();
        let flatStatus = this.flatStatus(status);
        let divisionKey = this.getDivisionKey(date);
        let dailyKey = this.getDailyKey(divisionKey);

        if (flatStatus === UP) {
            this.uptimeDataList[divisionKey].uptime += 1;
            this.dailyUptimeDataList[dailyKey].uptime += 1;
        } else {
            this.uptimeDataList[divisionKey].downtime += 1;
            this.dailyUptimeDataList[dailyKey].downtime += 1;
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
            this.uptimeDataList[divisionKey] = {
                uptime: 0,
                downtime: 0,
            };
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
            this.dailyUptimeDataList[dailyKey] = {
                uptime: 0,
                downtime: 0,
            };
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
        if (dailyUptimeData.uptime === 0 && dailyUptimeData.downtime === 0) {
            if (this.lastDailyUptimeData) {
                dailyUptimeData = this.lastDailyUptimeData;
            } else {
                return 0;
            }
        }

        return dailyUptimeData.uptime / (dailyUptimeData.uptime + dailyUptimeData.downtime);
    }

    /**
     * @param day
     */
    getUptime(day) {
        let dailyKey = this.getDailyKey(this.getCurrentDate().unix());

        let total = {
            uptime: 0,
            downtime: 0,
        };

        for (let i = 0; i < day; i++) {
            let dailyUptimeData = this.dailyUptimeDataList[dailyKey];

            if (dailyUptimeData) {
                total.uptime += dailyUptimeData.uptime;
                total.downtime += dailyUptimeData.downtime;
            }

            // Previous day
            dailyKey -= 86400;
        }

        if (total.uptime === 0 && total.downtime === 0) {
            if (this.lastDailyUptimeData) {
                total = this.lastDailyUptimeData;
            } else {
                return 0;
            }
        }

        return total.uptime / (total.uptime + total.downtime);
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
     *
     */
    clear() {

    }
}

module.exports = {
    UptimeCalculator
};
