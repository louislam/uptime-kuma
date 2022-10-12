const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const { log, utcToLocal, SQL_DATETIME_FORMAT_WITHOUT_SECOND, localToUTC } = require("../../src/util");
const { UptimeKumaServer } = require("../uptime-kuma-server");

class MaintenanceTimeslot extends BeanModel {

    async toPublicJSON() {
        const serverTimezoneOffset = UptimeKumaServer.getInstance().getTimezoneOffset();

        const obj = {
            id: this.id,
            startDate: this.start_date,
            endDate: this.end_date,
            startDateServerTimezone: utcToLocal(this.start_date, SQL_DATETIME_FORMAT_WITHOUT_SECOND),
            endDateServerTimezone: utcToLocal(this.end_date, SQL_DATETIME_FORMAT_WITHOUT_SECOND),
            serverTimezoneOffset,
        };

        return obj;
    }

    async toJSON() {
        return await this.toPublicJSON();
    }

    /**
     * @param {Maintenance} maintenance
     * @param {dayjs} minDate (For recurring type only) Generate a next timeslot from this date.
     * @param {boolean} removeExist Remove existing timeslot before create
     * @returns {Promise<MaintenanceTimeslot>}
     */
    static async generateTimeslot(maintenance, minDate = null, removeExist = false) {
        if (removeExist) {
            await R.exec("DELETE FROM maintenance_timeslot WHERE maintenance_id = ? ", [
                maintenance.id
            ]);
        }

        if (maintenance.strategy === "manual") {
            log.debug("maintenance", "No need to generate timeslot for manual type");
        } else if (maintenance.strategy === "single") {
            let bean = R.dispense("maintenance_timeslot");
            bean.maintenance_id = maintenance.id;
            bean.start_date = maintenance.start_date;
            bean.end_date = maintenance.end_date;
            bean.generated_next = true;
            return await R.store(bean);
        } else if (maintenance.strategy === "recurring-interval") {
            let bean = R.dispense("maintenance_timeslot");

            // Prevent dead loop, in case interval_day is not set
            if (!maintenance.interval_day || maintenance.interval_day <= 0) {
                maintenance.interval_day = 1;
            }

            let startOfTheDay = dayjs.utc(maintenance.start_date).format("HH:mm");
            log.debug("timeslot", "startOfTheDay: " + startOfTheDay);

            // Start Time
            let startTimeSecond = dayjs.utc(maintenance.start_time, "HH:mm").diff(dayjs.utc(startOfTheDay, "HH:mm"), "second");
            log.debug("timeslot", "startTime: " + startTimeSecond);

            // Duration
            let duration = dayjs.utc(maintenance.end_time, "HH:mm").diff(dayjs.utc(maintenance.start_time, "HH:mm"), "second");
            // Add 24hours if it is across day
            if (duration < 0) {
                duration += 24 * 3600;
            }

            // Bake StartDate + StartTime = Start DateTime
            let startDateTime = dayjs.utc(maintenance.start_date).add(startTimeSecond, "second");
            let endDateTime;

            // Keep generating from the first possible date, until it is ok
            while (true) {
                log.debug("timeslot", "startDateTime: " + startDateTime.format());

                // Handling out of effective date range
                if (startDateTime.diff(dayjs.utc(maintenance.end_date)) > 0) {
                    log.debug("timeslot", "Out of effective date range");
                    return null;
                }

                endDateTime = startDateTime.add(duration, "second");

                // If endDateTime is out of effective date range, use the end datetime from effective date range
                if (endDateTime.diff(dayjs.utc(maintenance.end_date)) > 0) {
                    endDateTime = dayjs.utc(maintenance.end_date);
                }

                // If minDate is set, the endDateTime must be bigger than it.
                // And the endDateTime must be bigger current time
                if (
                    (!minDate || endDateTime.diff(minDate) > 0) &&
                    endDateTime.diff(dayjs()) > 0
                ) {
                    break;
                }

                startDateTime = startDateTime.add(maintenance.interval_day, "day");
            }

            bean.maintenance_id = maintenance.id;
            bean.start_date = localToUTC(startDateTime);
            bean.end_date = localToUTC(endDateTime);
            bean.generated_next = false;
            return await R.store(bean);
        } else if (maintenance.strategy === "recurring-weekday") {
            // TODO
        } else if (maintenance.strategy === "recurring-day-of-month") {
            // TODO
        } else {
            throw new Error("Unknown maintenance strategy");
        }
    }
}

module.exports = MaintenanceTimeslot;
