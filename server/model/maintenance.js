const { BeanModel } = require("redbean-node/dist/bean-model");
const { parseTimeObject, parseTimeFromTimeObject, utcToLocal, localToUTC, log } = require("../../src/util");
const { timeObjectToUTC, timeObjectToLocal } = require("../util-server");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const Cron = require("croner");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const apicache = require("../modules/apicache");

class Maintenance extends BeanModel {

    static statusList = {};
    static jobList = {};

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON() {

        let dateRange = [];
        if (this.start_date) {
            dateRange.push(this.start_date);
            if (this.end_date) {
                dateRange.push(this.end_date);
            }
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
            timezone: await this.getTimezone(),
            timezoneOffset: await this.getTimezoneOffset(),
            status: await this.getStatus(),
        };

        if (this.strategy === "single") {
            obj.timeslotList.push({
                startDate: this.start_date,
                endDate: this.end_date,
            });
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
     * @returns {number[]} Array of active days in month
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
        bean.timezone = obj.timezone;
        bean.duration = obj.duration;
        bean.active = obj.active;

        if (obj.dateRange[0]) {
            bean.start_date = obj.dateRange[0];

            if (obj.dateRange[1]) {
                bean.end_date = obj.dateRange[1];
            }
        }

        bean.start_time = parseTimeFromTimeObject(obj.timeRange[0]);
        bean.end_time = parseTimeFromTimeObject(obj.timeRange[1]);

        bean.weekdays = JSON.stringify(obj.weekdays);
        bean.days_of_month = JSON.stringify(obj.daysOfMonth);

        await bean.generateCron();

        return bean;
    }

    /**
     * Run the cron
     */
    async run() {
        if (Maintenance.jobList[this.id]) {
            log.debug("maintenance", "Maintenance is already running, stop it first. id: " + this.id);
            this.stop();
        }

        log.debug("maintenance", "Run maintenance id: " + this.id);

        // 1.21.2 migration
        if (!this.cron) {
            //this.generateCron();
            //this.timezone = "UTC";
            // this.duration =
            if (this.cron) {
                //await R.store(this);
            }
        }

        if (this.strategy === "single") {
            Maintenance.jobList[this.id] = new Cron(this.start_date, { timezone: await this.getTimezone() }, () => {
                log.info("maintenance", "Maintenance id: " + this.id + " is under maintenance now");
                UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);
                apicache.clear();
            });
        }

    }

    stop() {
        if (Maintenance.jobList[this.id]) {
            Maintenance.jobList[this.id].stop();
            delete Maintenance.jobList[this.id];
        }
    }

    async isUnderMaintenance() {
        return (await this.getStatus()) === "under-maintenance";
    }

    async getTimezone() {
        if (!this.timezone) {
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

        if (!Maintenance.statusList[this.id]) {
            Maintenance.statusList[this.id] = "unknown";
        }

        return Maintenance.statusList[this.id];
    }

    setStatus(status) {
        Maintenance.statusList[this.id] = status;
    }

    async generateCron() {
        log.info("maintenance", "Generate cron for maintenance id: " + this.id);

        if (this.strategy === "recurring-interval") {
            let array = this.start_time.split(":");
            let hour = parseInt(array[0]);
            let minute = parseInt(array[1]);
            this.cron = minute + " " + hour + " */" + this.interval_day + " * *";
            this.duration = this.calcDuration();
            log.debug("maintenance", "Cron: " + this.cron);
            log.debug("maintenance", "Duration: " + this.duration);
        }

    }
}

module.exports = Maintenance;
