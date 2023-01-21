import dayjs from "dayjs";

/**
 * DateTime Mixin
 * Handled timezone and format
 */
export default {
    data() {
        return {
            userTimezone: localStorage.timezone || "auto",
        };
    },

    methods: {
        toUTC(value) {
            return dayjs.tz(value, this.timezone).utc().format();
        },

        /**
         * Used for <input type="datetime" />
         * @param value
         * @returns {string}
         */
        toDateTimeInputFormat(value) {
            return this.datetimeFormat(value, "YYYY-MM-DDTHH:mm");
        },

        /**
         * Return a given value in the format YYYY-MM-DD HH:mm:ss
         * @param {any} value Value to format as date time
         * @returns {string}
         */
        datetime(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD HH:mm:ss");
        },

        datetimeMaintenance(value) {
            const inputDate = new Date(value);
            const now = new Date(Date.now());

            if (inputDate.getFullYear() === now.getUTCFullYear() && inputDate.getMonth() === now.getUTCMonth() && inputDate.getDay() === now.getUTCDay()) {
                return this.datetimeFormat(value, "HH:mm");
            } else {
                return this.datetimeFormat(value, "YYYY-MM-DD HH:mm");
            }
        },

        /**
         * Return a given value in the format YYYY-MM-DD
         * @param {any} value  Value to format as date
         * @returns {string}
         */
        date(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD");
        },

        /**
         * Return a given value in the format HH:mm or if second is set
         * to true, HH:mm:ss
         * @param {any} value Value to format
         * @param {boolean} second Should seconds be included?
         * @returns {string}
         */
        time(value, second = true) {
            let secondString;
            if (second) {
                secondString = ":ss";
            } else {
                secondString = "";
            }
            return this.datetimeFormat(value, "HH:mm" + secondString);
        },

        /**
         * Return a value in a custom format
         * @param {any} value Value to format
         * @param {any} format Format to return value in
         * @returns {string}
         */
        datetimeFormat(value, format) {
            if (value !== undefined && value !== "") {
                return dayjs.utc(value).tz(this.timezone).format(format);
            }
            return "";
        },
    },

    computed: {
        timezone() {
            if (this.userTimezone === "auto") {
                return dayjs.tz.guess();
            }

            return this.userTimezone;
        },
    }

};
