const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const dayjs = require("dayjs");

class MaintenanceTimeslot extends BeanModel {

    async toPublicJSON() {

    }

    async toJSON() {

    }

    /**
     *
     * @param {Maintenance} maintenance
     * @param {dayjs} startFrom (For recurring type only) Generate Timeslot from this date, if it is smaller than the current date, it will use the current date instead. As generating a passed timeslot is meaningless.
     * @param {boolean} removeExist Remove existing timeslot before create
     * @returns {Promise<void>}
     */
    static async generateTimeslot(maintenance, startFrom = null, removeExist = false) {
        if (!startFrom) {
            startFrom = dayjs();
        }

        if (removeExist) {
            await R.exec("DELETE FROM maintenance_timeslot WHERE maintenance_id = ? ", [
                maintenance.id
            ]);
        }

        if (maintenance.strategy === "single") {
            let bean = R.dispense("maintenance_timeslot");
            bean.maintenance_id = maintenance.id;
            bean.start_date = maintenance.start_datetime;
            bean.end_date = maintenance.end_datetime;
            bean.generated_next = true;
            await R.store(bean);
        } else {
            throw new Error("Unknown maintenance strategy");
        }
    }
}

module.exports = MaintenanceTimeslot;
