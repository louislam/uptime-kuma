const { BeanModel } = require("redbean-node/dist/bean-model");
const { parseTimeObject, parseTimeFromTimeObject, log } = require("../../src/util");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const Cron = require("croner");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const apicache = require("../modules/apicache");

class Maintenance extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON() {

        let dateRange = [];
        if (this.start_date) {
            dateRange.push(this.start_date);
        } else {
            dateRange.push(null);
        }

        if (this.end_date) {
            dateRange.push(this.end_date);
        }

        let timeRange = [];
        let startTime = parseTimeObject(this.start_time);
        timeRange.push(startTime);
        let endTime = parseTimeObject(this.end_time);
        timeRange.push(endTime);

        let obj = {
            id: this.id,
            title: this.title,
            description: this.description,
            strategy: this.strategy,
            intervalDay: this.interval_day,
            active: !!this.active,
            dateRange: dateRange,
            timeRange: timeRange,
            weekdays: (this.weekdays) ? JSON.parse(this.weekdays) : [],
            daysOfMonth: (this.days_of_month) ? JSON.parse(this.days_of_month) : [],
            timeslotList: [],
            cron: this.cron,
            duration: this.duration,
            durationMinutes: parseInt(this.duration / 60),
            timezone: await this.getTimezone(),         // Only valid timezone
            timezoneOption: this.timezone,               // Mainly for dropdown menu, because there is a option "SAME_AS_SERVER"
            timezoneOffset: await this.getTimezoneOffset(),
            status: await this.getStatus(),
        };

        if (this.strategy === "manual") {
            // Do nothing, no timeslots
        } else if (this.strategy === "single") {
            obj.timeslotList.push({
                startDate: this.start_date,
                endDate: this.end_date,
            });
        } else {
            // Should be cron or recurring here
            if (this.beanMeta.job) {
                let runningTimeslot = this.getRunningTimeslot();

                if (runningTimeslot) {
                    obj.timeslotList.push(runningTimeslot);
                }

                let nextRunDate = this.beanMeta.job.nextRun();
                if (nextRunDate) {
                    let startDateDayjs = dayjs(nextRunDate);

                    let startDate = startDateDayjs.toISOString();
                    let endDate = startDateDayjs.add(this.duration, "second").toISOString();

                    obj.timeslotList.push({
                        startDate,
                        endDate,
                    });
                }
            }
        }

        if (!Array.isArray(obj.weekdays)) {
            obj.weekdays = [];
        }

        if (!Array.isArray(obj.daysOfMonth)) {
            obj.daysOfMonth = [];
        }

        return obj;
    }

    /**
     * Return an object that ready to parse to JSON
     * @param {string} timezone If not specified, the timeRange will be in UTC
     * @returns {Object}
     */
    async toJSON(timezone = null) {
        return this.toPublicJSON(timezone);
    }

    /**
     * Get a list of weekdays that the maintenance is active for
     * Monday=1, Tuesday=2 etc.
     * @returns {number[]} Array of active weekdays
     */
    getDayOfWeekList() {
        log.debug("timeslot", "List: " + this.weekdays);
        return JSON.parse(this.weekdays).sort(function (a, b) {
            return a - b;
        });
    }

    /**
     * Get a list of days in month that maintenance is active for
     * @returns {number[]|string[]} Array of active days in month
     */
    getDayOfMonthList() {
        return JSON.parse(this.days_of_month).sort(function (a, b) {
            return a - b;
        });
    }

    /**
     * Get the duration of maintenance in seconds
     * @returns {number} Duration of maintenance
     */
    calcDuration() {
        let duration = dayjs.utc(this.end_time, "HH:mm").diff(dayjs.utc(this.start_time, "HH:mm"), "second");
        // Add 24hours if it is across day
        if (duration < 0) {
            duration += 24 * 3600;
        }
        return duration;
    }

    /**
     * Convert data from socket to bean
     * @param {Bean} bean Bean to fill in
     * @param {Object} obj Data to fill bean with
     * @returns {Bean} Filled bean
     */
    static async jsonToBean(bean, obj) {
        if (obj.id) {
            bean.id = obj.id;
        }

        bean.title = obj.title;
        bean.description = obj.description;
        bean.strategy = obj.strategy;
        bean.interval_day = obj.intervalDay;
        bean.timezone = obj.timezoneOption;
        bean.active = obj.active;

        if (obj.dateRange[0]) {
            bean.start_date = obj.dateRange[0];
        } else {
            bean.start_date = null;
        }

        if (obj.dateRange[1]) {
            bean.end_date = obj.dateRange[1];
        } else {
            bean.end_date = null;
        }

        if (bean.strategy === "cron") {
            bean.duration = obj.durationMinutes * 60;
            bean.cron = obj.cron;
            this.validateCron(bean.cron);
        }

        if (bean.strategy.startsWith("recurring-")) {
            bean.start_time = parseTimeFromTimeObject(obj.timeRange[0]);
            bean.end_time = parseTimeFromTimeObject(obj.timeRange[1]);
            bean.weekdays = JSON.stringify(obj.weekdays);
            bean.days_of_month = JSON.stringify(obj.daysOfMonth);
            await bean.generateCron();
            this.validateCron(bean.cron);
        }
        return bean;
    }

    /**
     * Throw error if cron is invalid
     * @param cron
     * @returns {Promise<void>}
     */
    static async validateCron(cron) {
        let job = new Cron(cron, () => {});
        job.stop();
    }

    /**
     * Run the cron
     */
    async run(throwError = false) {
        if (this.beanMeta.job) {
            log.debug("maintenance", "Maintenance is already running, stop it first. id: " + this.id);
            this.stop();
        }

        log.debug("maintenance", "Run maintenance id: " + this.id);

        // 1.21.2 migration
        if (!this.cron) {
            await this.generateCron();
            if (!this.timezone) {
                this.timezone = "UTC";
            }
            if (this.cron) {
                await R.store(this);
            }
        }

        if (this.strategy === "manual") {
            // Do nothing, because it is controlled by the user
        } else if (this.strategy === "single") {
            this.beanMeta.job = new Cron(this.start_date, { timezone: await this.getTimezone() }, () => {
                log.info("maintenance", "Maintenance id: " + this.id + " is under maintenance now");
                UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);
                apicache.clear();
            });
        } else if (this.cron != null) {
            // Here should be cron or recurring
            try {
                this.beanMeta.status = "scheduled";

                let startEvent = (customDuration = 0) => {
                    log.info("maintenance", "Maintenance id: " + this.id + " is under maintenance now");

                    this.beanMeta.status = "under-maintenance";
                    clearTimeout(this.beanMeta.durationTimeout);

                    // Check if duration is still in the window. If not, use the duration from the current time to the end of the window
                    let duration;

                    if (customDuration > 0) {
                        duration = customDuration;
                    } else if (this.end_date) {
                        let d = dayjs(this.end_date).diff(dayjs(), "second");
                        if (d < this.duration) {
                            duration = d * 1000;
                        }
                    } else {
                        duration = this.duration * 1000;
                    }

                    UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);

                    this.beanMeta.durationTimeout = setTimeout(() => {
                        // End of maintenance for this timeslot
                        this.beanMeta.status = "scheduled";
                        UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);
                    }, duration);
                };

                // Create Cron
                this.beanMeta.job = new Cron(this.cron, {
                    timezone: await this.getTimezone(),
                }, startEvent);

                // Continue if the maintenance is still in the window
                let runningTimeslot = this.getRunningTimeslot();
                let current = dayjs();

                if (runningTimeslot) {
                    let duration = dayjs(runningTimeslot.endDate).diff(current, "second") * 1000;
                    log.debug("maintenance", "Maintenance id: " + this.id + " Remaining duration: " + duration + "ms");
                    startEvent(duration);
                }

            } catch (e) {
                log.error("maintenance", "Error in maintenance id: " + this.id);
                log.error("maintenance", "Cron: " + this.cron);
                log.error("maintenance", e);

                if (throwError) {
                    throw e;
                }
            }

        } else {
            log.error("maintenance", "Maintenance id: " + this.id + " has no cron");
        }
    }

    getRunningTimeslot() {
        let start = dayjs(this.beanMeta.job.nextRun(dayjs().add(-this.duration, "second").toDate()));
        let end = start.add(this.duration, "second");
        let current = dayjs();

        if (current.isAfter(start) && current.isBefore(end)) {
            return {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
            };
        } else {
            return null;
        }
    }

    stop() {
        if (this.beanMeta.job) {
            this.beanMeta.job.stop();
            delete this.beanMeta.job;
        }
    }

    async isUnderMaintenance() {
        return (await this.getStatus()) === "under-maintenance";
    }

    async getTimezone() {
        if (!this.timezone || this.timezone === "SAME_AS_SERVER") {
            return await UptimeKumaServer.getInstance().getTimezone();
        }
        return this.timezone;
    }

    async getTimezoneOffset() {
        return dayjs.tz(dayjs(), await this.getTimezone()).format("Z");
    }

    async getStatus() {
        if (!this.active) {
            return "inactive";
        }

        if (this.strategy === "manual") {
            return "under-maintenance";
        }

        // Check if the maintenance is started
        if (this.start_date && dayjs().isBefore(dayjs.tz(this.start_date, await this.getTimezone()))) {
            return "scheduled";
        }

        // Check if the maintenance is ended
        if (this.end_date && dayjs().isAfter(dayjs.tz(this.end_date, await this.getTimezone()))) {
            return "ended";
        }

        if (this.strategy === "single") {
            return "under-maintenance";
        }

        if (!this.beanMeta.status) {
            return "unknown";
        }

        return this.beanMeta.status;
    }

    /**
     * Generate Cron for recurring maintenance
     * @returns {Promise<void>}
     */
    async generateCron() {
        log.info("maintenance", "Generate cron for maintenance id: " + this.id);

        if (this.strategy === "cron") {
            // Do nothing for cron
        } else if (!this.strategy.startsWith("recurring-")) {
            this.cron = "";
        } else if (this.strategy === "recurring-interval") {
            let array = this.start_time.split(":");
            let hour = parseInt(array[0]);
            let minute = parseInt(array[1]);
            this.cron = minute + " " + hour + " */" + this.interval_day + " * *";
            this.duration = this.calcDuration();
            log.debug("maintenance", "Cron: " + this.cron);
            log.debug("maintenance", "Duration: " + this.duration);
        } else if (this.strategy === "recurring-weekday") {
            let list = this.getDayOfWeekList();
            let array = this.start_time.split(":");
            let hour = parseInt(array[0]);
            let minute = parseInt(array[1]);
            this.cron = minute + " " + hour + " * * " + list.join(",");
            this.duration = this.calcDuration();
        } else if (this.strategy === "recurring-day-of-month") {
            let list = this.getDayOfMonthList();
            let array = this.start_time.split(":");
            let hour = parseInt(array[0]);
            let minute = parseInt(array[1]);

            let dayList = [];

            for (let day of list) {
                if (typeof day === "string" && day.startsWith("lastDay")) {
                    if (day === "lastDay1") {
                        dayList.push("L");
                    }
                    // Unfortunately, lastDay2-4 is not supported by cron
                } else {
                    dayList.push(day);
                }
            }

            // Remove duplicate
            dayList = [ ...new Set(dayList) ];

            this.cron = minute + " " + hour + " " + dayList.join(",") + " * *";
            this.duration = this.calcDuration();
        }

    }
}

module.exports = Maintenance;
