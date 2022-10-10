const { BeanModel } = require("redbean-node/dist/bean-model");
const { parseTimeObject, parseTimeFromTimeObject, utcToLocal, localToUTC } = require("../../src/util");
const { isArray } = require("chart.js/helpers");
const { timeObjectToUTC, timeObjectToLocal } = require("../util-server");
const { R } = require("redbean-node");
const dayjs = require("dayjs");

class Maintenance extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON() {

        let dateRange = [];
        if (this.start_date) {
            dateRange.push(utcToLocal(this.start_date));
            if (this.end_date) {
                dateRange.push(utcToLocal(this.end_date));
            }
        }

        let timeRange = [];
        let startTime = timeObjectToLocal(parseTimeObject(this.start_time));
        timeRange.push(startTime);
        let endTime = timeObjectToLocal(parseTimeObject(this.end_time));
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
            timeslotList: await this.getTimeslotList(),
        };

        if (!isArray(obj.weekdays)) {
            obj.weekdays = [];
        }

        if (!isArray(obj.daysOfMonth)) {
            obj.daysOfMonth = [];
        }

        // Maintenance Status
        if (!obj.active) {
            obj.status = "inactive";
        } else if (obj.strategy === "manual" || obj.timeslotList.length > 0) {
            for (let timeslot of obj.timeslotList) {
                if (dayjs.utc(timeslot.start_date) <= dayjs.utc() && dayjs.utc(timeslot.end_date) >= dayjs.utc()) {
                    obj.status = "under-maintenance";
                    break;
                }
            }

            if (!obj.status) {
                obj.status = "scheduled";
            }
        } else if (obj.timeslotList.length === 0) {
            obj.status = "ended";
        } else {
            obj.status = "unknown";
        }

        return obj;
    }

    /**
     * Only get future or current timeslots only
     * @returns {Promise<[]>}
     */
    async getTimeslotList() {
        return await R.getAll(`
            SELECT maintenance_timeslot.*
            FROM maintenance_timeslot, maintenance
            WHERE maintenance_timeslot.maintenance_id = maintenance.id
            AND maintenance.id = ?
            AND ${Maintenance.getActiveAndFutureMaintenanceSQLCondition()}
        `, [
            this.id
        ]);
    }

    /**
     * Return an object that ready to parse to JSON
     * @param {string} timezone If not specified, the timeRange will be in UTC
     * @returns {Object}
     */
    async toJSON(timezone = null) {
        return this.toPublicJSON(timezone);
    }

    static jsonToBean(bean, obj) {
        if (obj.id) {
            bean.id = obj.id;
        }

        // Apply timezone offset to timeRange, as it cannot apply automatically.
        if (obj.timeRange[0]) {
            timeObjectToUTC(obj.timeRange[0]);
            if (obj.timeRange[1]) {
                timeObjectToUTC(obj.timeRange[1]);
            }
        }

        bean.title = obj.title;
        bean.description = obj.description;
        bean.strategy = obj.strategy;
        bean.interval_day = obj.intervalDay;
        bean.active = obj.active;

        if (obj.dateRange[0]) {
            bean.start_date = localToUTC(obj.dateRange[0]);

            if (obj.dateRange[1]) {
                bean.end_date = localToUTC(obj.dateRange[1]);
            }
        }

        bean.start_time = parseTimeFromTimeObject(obj.timeRange[0]);
        bean.end_time = parseTimeFromTimeObject(obj.timeRange[1]);

        bean.weekdays = JSON.stringify(obj.weekdays);
        bean.days_of_month = JSON.stringify(obj.daysOfMonth);

        return bean;
    }

    /**
     * SQL conditions for active maintenance
     * @returns {string}
     */
    static getActiveMaintenanceSQLCondition() {
        return `

            (maintenance_timeslot.start_date <= DATETIME('now')
            AND maintenance_timeslot.end_date >= DATETIME('now')
            AND maintenance.active = 1)
            OR
            (maintenance.strategy = 'manual' AND active = 1)

        `;
    }

    /**
     * SQL conditions for active and future maintenance
     * @returns {string}
     */
    static getActiveAndFutureMaintenanceSQLCondition() {
        return `
            (maintenance_timeslot.end_date >= DATETIME('now')
            AND maintenance.active = 1)
            OR
            (maintenance.strategy = 'manual' AND active = 1)
        `;
    }
}

module.exports = Maintenance;
