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
            // Prevent dead loop, in case interval_day is not set
            if (!maintenance.interval_day || maintenance.interval_day <= 0) {
                maintenance.interval_day = 1;
            }

            return await this.handleRecurringType(maintenance, minDate, (startDateTime) => {
                return startDateTime.add(maintenance.interval_day, "day");
            }, () => {
                return true;
            });

        } else if (maintenance.strategy === "recurring-weekday") {
            let dayOfWeekList = maintenance.getDayOfWeekList();
            log.debug("timeslot", dayOfWeekList);

            if (dayOfWeekList.length <= 0) {
                log.debug("timeslot", "No weekdays selected?");
                return null;
            }

            const isValid = (startDateTime) => {
                log.debug("timeslot", "nextDateTime: " + startDateTime);

                let day = startDateTime.local().day();
                log.debug("timeslot", "nextDateTime.day(): " + day);

                return dayOfWeekList.includes(day);
            };

            return await this.handleRecurringType(maintenance, minDate, (startDateTime) => {
                while (true) {
                    startDateTime = startDateTime.add(1, "day");

                    if (isValid(startDateTime)) {
                        return startDateTime;
                    }
                }
            }, isValid);

        } else if (maintenance.strategy === "recurring-day-of-month") {
            let dayOfMonthList = maintenance.getDayOfMonthList();
            if (dayOfMonthList.length <= 0) {
                log.debug("timeslot", "No day selected?");
                return null;
            }

            const isValid = (startDateTime) => {
                let day = parseInt(startDateTime.local().format("D"));

                log.debug("timeslot", "day: " + day);

                // Check 1-31
                if (dayOfMonthList.includes(day)) {
                    return startDateTime;
                }

                // Check "lastDay1","lastDay2"...
                let daysInMonth = startDateTime.daysInMonth();
                let lastDayList = [];

                // Small first, e.g. 28 > 29 > 30 > 31
                for (let i = 4; i >= 1; i--) {
                    if (dayOfMonthList.includes("lastDay" + i)) {
                        lastDayList.push(daysInMonth - i + 1);
                    }
                }
                log.debug("timeslot", lastDayList);
                return lastDayList.includes(day);
            };

            return await this.handleRecurringType(maintenance, minDate, (startDateTime) => {
                while (true) {
                    startDateTime = startDateTime.add(1, "day");
                    if (isValid(startDateTime)) {
                        return startDateTime;
                    }
                }
            }, isValid);
        } else {
            throw new Error("Unknown maintenance strategy");
        }
    }

    /**
     * Generate a next timeslot for all recurring types
     * @param maintenance
     * @param minDate
     * @param {function} nextDayCallback The logic how to get the next possible day
     * @param {function} isValidCallback Check the day whether is matched the current strategy
     * @returns {Promise<null|MaintenanceTimeslot>}
     */
    static async handleRecurringType(maintenance, minDate, nextDayCallback, isValidCallback) {
        let bean = R.dispense("maintenance_timeslot");

        let duration = maintenance.getDuration();
        let startDateTime = maintenance.getStartDateTime();
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
            // Is valid under current recurring strategy
            if (
                (!minDate || endDateTime.diff(minDate) > 0) &&
                endDateTime.diff(dayjs()) > 0 &&
                isValidCallback(startDateTime)
            ) {
                break;
            }
            startDateTime = nextDayCallback(startDateTime);
        }

        bean.maintenance_id = maintenance.id;
        bean.start_date = localToUTC(startDateTime);
        bean.end_date = localToUTC(endDateTime);
        bean.generated_next = false;
        return await R.store(bean);
    }
}

module.exports = MaintenanceTimeslot;
