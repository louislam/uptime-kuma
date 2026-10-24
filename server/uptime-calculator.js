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

    /**
     * Whether the current minute/hour/day buckets were seeded from the database
     * @type {boolean}
     */
    currentBucketsLoaded = false;

    /**
     * Last hourly bucket in which old stat rows were pruned
     * @type {number|null}
     */
    lastPruneHour = null;

    /**
     * Last minute in which the hourly stat row was written
     * @type {number|null}
     */
    lastHourlyStore = null;

    /**
     * Last minute in which the daily stat row was written
     * @type {number|null}
     */
    lastDailyStore = null;

    /**
     * Whether the DB history has been loaded
     * @type {boolean}
     */
    historyLoaded = false;

    /**
     * In-flight history load
     * @type {Promise<void>|null}
     */
    historyLoadingPromise = null;

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
     * Remove all monitors from the list
     * @returns {Promise<void>}
     */
    static async removeAll() {
        UptimeCalculator.list = {};
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
     * Initialize the uptime calculator for a monitor.
     * History is loaded on demand (see ensureHistoryLoaded), so a beat never
     * pays for 1000+ stat rows.
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<void>}
     */
    async init(monitorID) {
        this.monitorID = monitorID;
    }

    /**
     * Load the recent stat history if it has not been loaded yet
     * @returns {Promise<void>}
     */
    async ensureHistoryLoaded() {
        if (this.historyLoaded) {
            return;
        }
        if (!this.historyLoadingPromise) {
            this.historyLoadingPromise = this.loadHistory();
        }
        await this.historyLoadingPromise;
    }

    /**
     * Load 24h minutely, 30d hourly and 365d daily stat rows from the database.
     * Uses plain rows instead of redbean beans: one query per table, no per-row
     * bean construction, which dominated chart latency for a single monitor.
     * @returns {Promise<void>}
     */
    async loadHistory() {
        let monitorID = this.monitorID;

        let now = this.getCurrentDate();

        const load = async (table, since, list) => {
            const rows = await R.getAll(
                `SELECT timestamp, up, down, ping, ping_min, ping_max, extras
                 FROM ${table} WHERE monitor_id = ? AND timestamp > ? ORDER BY timestamp`,
                [monitorID, since]
            );
            for (const row of rows) {
                let data = {
                    up: row.up,
                    down: row.down,
                    avgPing: row.ping,
                    minPing: row.ping_min,
                    maxPing: row.ping_max,
                };
                if (row.extras != null) {
                    data = { ...data, ...JSON.parse(row.extras) };
                }
                this.addHistoryEntry(list, row.timestamp, data);
            }
        };

        await load("stat_minutely", this.getMinutelyKey(now.subtract(24, "hour")), this.minutelyUptimeDataList);
        await load("stat_hourly", this.getHourlyKey(now.subtract(30, "day")), this.hourlyUptimeDataList);
        await load("stat_daily", this.getDailyKey(now.subtract(365, "day")), this.dailyUptimeDataList);

        this.historyLoaded = true;
    }

    /**
     * @param {number} status status
     * @param {number} ping Ping
     * @param {dayjs.Dayjs} date Date (Only for migration)
     * @returns {Promise<dayjs.Dayjs>} date
     * @throws {Error} Invalid status
     */
    async update(status, ping = 0, date) {
        // A beat without an explicit date happens now, so its current buckets must be
        // continued from the database. Check this before defaulting `date`.
        const isLiveBeat = !date;

        if (!date) {
            date = this.getCurrentDate();
        }

        let flatStatus = this.flatStatus(status);

        if (flatStatus === DOWN && ping > 0) {
            log.debug("uptime_calc", "The ping is not effective when the status is DOWN");
        }

        let divisionKey = this.getMinutelyKey(date);
        let hourlyKey = this.getHourlyKey(date);
        let dailyKey = this.getDailyKey(date);

        // Continue the current buckets from their stored values instead of starting at zero,
        // otherwise a restart would overwrite the minute/hour/day counts with only new beats
        if (!this.migrationMode && isLiveBeat && !this.currentBucketsLoaded && !this.historyLoaded) {
            await this.ensureCurrentBuckets(divisionKey, hourlyKey, dailyKey);
        }

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
            log.debug("uptime_calc", "Skip storing data in test mode");
            return date;
        }

        // Store the aggregates. Minutely is written every beat, hourly/daily at most
        // once per minute: their values only need to be durable, not per-check.
        let currentDate = this.getCurrentDate();
        const currentMinute = this.getMinutelyKey(currentDate, false);

        if (this.lastDailyStore !== currentMinute) {
            this.lastDailyStore = currentMinute;
            await this.upsertStat("stat_daily", dailyKey, dailyData);
        }

        if (this.lastHourlyStore !== currentMinute) {
            this.lastHourlyStore = currentMinute;
            if (!this.migrationMode || date.isAfter(currentDate.subtract(this.statHourlyKeepDay, "day"))) {
                await this.upsertStat("stat_hourly", hourlyKey, hourlyData);
            }
        }

        if (!this.migrationMode || date.isAfter(currentDate.subtract(this.statMinutelyKeepHour, "hour"))) {
            await this.upsertStat("stat_minutely", divisionKey, minutelyData);
        }

        // No need to remove old data in migration mode
        // Prune at most once per hour per monitor; retention is measured in hours/days,
        // so doing it on every beat only adds write transactions at scale
        if (!this.migrationMode && this.lastPruneHour !== hourlyKey) {
            this.lastPruneHour = hourlyKey;
            log.debug("uptime_calc", "Remove old data");
            await R.exec("DELETE FROM stat_minutely WHERE monitor_id = ? AND timestamp < ?", [
                this.monitorID,
                this.getMinutelyKey(currentDate.subtract(this.statMinutelyKeepHour, "hour"), false),
            ]);

            await R.exec("DELETE FROM stat_hourly WHERE monitor_id = ? AND timestamp < ?", [
                this.monitorID,
                this.getHourlyKey(currentDate.subtract(this.statHourlyKeepDay, "day"), false),
            ]);
        }

        return date;
    }

    /**
     * Add a history entry without duplicating a bucket that already exists
     * @param {object} list Bucket list
     * @param {number} key Bucket timestamp
     * @param {object} data Bucket data
     * @returns {void}
     */
    addHistoryEntry(list, key, data) {
        if (key in list) {
            Object.assign(list[key], data);
        } else {
            list.push(key, data);
        }
    }

    /**
     * Load only the three buckets that are currently being written, so a restart
     * continues their counts. Full history is loaded on demand for charts only.
     * @param {number} minutelyKey Current minute bucket
     * @param {number} hourlyKey Current hour bucket
     * @param {number} dailyKey Current day bucket
     * @returns {Promise<void>}
     */
    async ensureCurrentBuckets(minutelyKey, hourlyKey, dailyKey) {
        if (this.currentBucketsLoaded || this.historyLoaded) {
            return;
        }
        this.currentBucketsLoaded = true;

        const [minutely, hourly, daily] = await Promise.all([
            R.findOne("stat_minutely", " monitor_id = ? AND timestamp = ? ", [this.monitorID, minutelyKey]),
            R.findOne("stat_hourly", " monitor_id = ? AND timestamp = ? ", [this.monitorID, hourlyKey]),
            R.findOne("stat_daily", " monitor_id = ? AND timestamp = ? ", [this.monitorID, dailyKey]),
        ]);

        this.applyStatBean(this.minutelyUptimeDataList, minutelyKey, minutely);
        this.applyStatBean(this.hourlyUptimeDataList, hourlyKey, hourly);
        this.applyStatBean(this.dailyUptimeDataList, dailyKey, daily);
    }

    /**
     * Copy a stored stat row into an in-memory bucket
     * @param {object} list Bucket list
     * @param {number} key Bucket timestamp
     * @param {import("redbean-node").Bean | null} bean Stored stat row
     * @returns {void}
     */
    applyStatBean(list, key, bean) {
        const data = list[key];
        if (!bean || !data) {
            return;
        }
        Object.assign(data, {
            up: bean.up,
            down: bean.down,
            avgPing: bean.ping,
            minPing: bean.pingMin,
            maxPing: bean.pingMax,
            ...(bean.extras != null ? JSON.parse(bean.extras) : {}),
        });
    }

    /**
     * Insert or update one stat row without going through redbean beans
     * @param {string} table stat table name
     * @param {number} timestamp Bucket timestamp
     * @param {object} data Aggregated uptime data
     * @returns {Promise<void>}
     */
    async upsertStat(table, timestamp, data) {
        const { up, down, avgPing, minPing, maxPing, ...extras } = data;
        const row = {
            monitor_id: this.monitorID,
            timestamp,
            up,
            down,
            ping: avgPing,
            ping_min: minPing,
            ping_max: maxPing,
        };
        const mergeColumns = ["up", "down", "ping", "ping_min", "ping_max"];
        if (Object.keys(extras).length > 0) {
            row.extras = JSON.stringify(extras);
            mergeColumns.push("extras");
        }
        await R.knex(table).insert(row).onConflict(["monitor_id", "timestamp"]).merge(mergeColumns);
    }

    /**
     * Convert timestamp to minutely key
     * @param {dayjs.Dayjs} date The heartbeat date
     * @param {boolean} createIfMissing Whether to create a missing bucket, defaults to true
     * @returns {number} Timestamp
     */
    getMinutelyKey(date, createIfMissing = true) {
        // Truncate value to minutes (e.g. 2021-01-01 12:34:56 -> 2021-01-01 12:34:00)
        date = date.startOf("minute");

        // Convert to timestamp in second
        let divisionKey = date.unix();

        if (createIfMissing && !(divisionKey in this.minutelyUptimeDataList)) {
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
     * @param {boolean} createIfMissing Whether to create a missing bucket, defaults to true
     * @returns {number} Timestamp
     */
    getHourlyKey(date, createIfMissing = true) {
        // Truncate value to hours (e.g. 2021-01-01 12:34:56 -> 2021-01-01 12:00:00)
        date = date.startOf("hour");

        // Convert to timestamp in second
        let divisionKey = date.unix();

        if (createIfMissing && !(divisionKey in this.hourlyUptimeDataList)) {
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
     * @param {boolean} createIfMissing Whether to create a missing bucket, defaults to true
     * @returns {number} Timestamp
     */
    getDailyKey(date, createIfMissing = true) {
        // Truncate value to start of day (e.g. 2021-01-01 12:34:56 -> 2021-01-01 00:00:00)
        // Considering if the user keep changing could affect the calculation, so use UTC time to avoid this problem.
        date = date.utc().startOf("day");
        let dailyKey = date.unix();

        if (createIfMissing && !this.dailyUptimeDataList[dailyKey]) {
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
                throw new Error(`Unsupported unit (${unit}) for badge duration ${duration}`);
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

    /**
     * Clear all statistics and heartbeats for a monitor
     * @param {number} monitorID the id of the monitor
     * @returns {Promise<void>}
     */
    static async clearStatistics(monitorID) {
        await R.exec("DELETE FROM heartbeat WHERE monitor_id = ?", [monitorID]);

        await R.exec("DELETE FROM stat_minutely WHERE monitor_id = ?", [monitorID]);
        await R.exec("DELETE FROM stat_hourly WHERE monitor_id = ?", [monitorID]);
        await R.exec("DELETE FROM stat_daily WHERE monitor_id = ?", [monitorID]);

        await UptimeCalculator.remove(monitorID);
    }

    /**
     * Clear all statistics and heartbeats for all monitors
     * @returns {Promise<void>}
     */
    static async clearAllStatistics() {
        await R.exec("DELETE FROM heartbeat");
        await R.exec("DELETE FROM stat_minutely");
        await R.exec("DELETE FROM stat_hourly");
        await R.exec("DELETE FROM stat_daily");

        await UptimeCalculator.removeAll();
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
