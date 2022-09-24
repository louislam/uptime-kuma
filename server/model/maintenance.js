const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
let timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const { BeanModel } = require("redbean-node/dist/bean-model");
const { parseVueDatePickerTimeFormat, parseTimeFormatFromVueDatePicker } = require("../../src/util");
const { isArray } = require("chart.js/helpers");

class Maintenance extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON() {

        let dateTimeRange = [];
        if (this.start_datetime) {
            dateTimeRange.push( this.start_datetime);
            if (this.end_datetime) {
                dateTimeRange.push( this.end_datetime);
            }
        }

        let dateRange = [];
        if (this.start_date) {
            dateRange.push( this.start_date);
            if (this.end_date) {
                dateRange.push( this.end_date);
            }
        }

        let timeRange = [];
        let startTime = parseVueDatePickerTimeFormat(this.start_time);
        timeRange.push(startTime);
        let endTime = parseVueDatePickerTimeFormat(this.end_time);
        timeRange.push(endTime);

        let obj = {
            id: this.id,
            title: this.title,
            description: this.description,
            strategy: this.strategy,
            intervalDay: this.interval_day,
            active: !!this.active,
            dateTimeRange: dateTimeRange,
            dateRange: dateRange,
            timeRange: timeRange,
            weekdays: (this.weekdays) ? JSON.parse(this.weekdays) : [],
            daysOfMonth: (this.days_of_month) ? JSON.parse(this.days_of_month) : [],
        };

        if (!isArray(obj.weekdays)) {
            obj.weekdays = [];
        }

        if (!isArray(obj.daysOfMonth)) {
            obj.daysOfMonth = [];
        }

        return obj;
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    async toJSON() {
        return this.toPublicJSON();
    }

    static jsonToBean(bean, obj) {
        if (obj.id) {
            bean.id = obj.id;
        }

        bean.title = obj.title;
        bean.description = obj.description;
        bean.strategy = obj.strategy;
        bean.interval_day = obj.intervalDay;
        bean.active = obj.active;

        if (obj.dateRange[0]) {
            bean.start_date = obj.dateRange[0];

            if (obj.dateRange[1]) {
                bean.end_date = obj.dateRange[1];
            }
        }

        if (obj.dateTimeRange[0]) {
            bean.start_datetime = obj.dateTimeRange[0];

            if (obj.dateTimeRange[1]) {
                bean.end_datetime = obj.dateTimeRange[1];
            }
        }

        bean.start_time = parseTimeFormatFromVueDatePicker(obj.timeRange[0]);
        bean.end_time = parseTimeFormatFromVueDatePicker(obj.timeRange[1]);

        bean.weekdays = JSON.stringify(obj.weekdays);
        bean.days_of_month = JSON.stringify(obj.daysOfMonth);

        return bean;
    }
}

module.exports = Maintenance;
