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
        /**
         * Convert value to UTC
         * @param {string | number | Date | dayjs.Dayjs} value Time
         * value to convert
         * @returns {dayjs.Dayjs} Converted time
         */
        toUTC(value) {
            return dayjs.tz(value, this.timezone).utc().format();
        },

        /**
         * Used for <input type="datetime" />
         * @param {string | number | Date | dayjs.Dayjs} value Value to
         * convert
         * @returns {string} Datetime string
         */
        toDateTimeInputFormat(value) {
            return this.datetimeFormat(value, "YYYY-MM-DDTHH:mm");
        },

        /**
         * Return a given value in the format YYYY-MM-DD HH:mm:ss
         * @param {any} value Value to format as date time
         * @returns {string} Formatted string
         */
        datetime(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD HH:mm:ss");
        },
        formatInLocale(value, options) {
            if (value === undefined || value === "" || value === null) {
                return "";
            }
            const date = value instanceof Date ? value : daysj.utc(value).toDate();
            if (NUmber.isNaN(date.getTime())) {
                return "";
            }

            const formatOptions = {
                timeZone: this.timezone,
                hourCycle: "h23",
                ...options,
            };

            try {
                return this.$d(date, formatOptions);
            } catch (error) {
                return this.$d(date, { ...formatOptions, locale: "en" });
            }
        },
        /**
         * Converts a Unix timestamp to a formatted date and time string.
         * @param {number} value - The Unix timestamp to convert.
         * @returns {string} The formatted date and time string.
         */
        unixToDateTime(value) {
            return this.formatInLocale(dayjs.unix(value).toDate(), {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
        },

        /**
         * Converts a Unix timestamp to a dayjs object.
         * @param {number} value - The Unix timestamp to convert.
         * @returns {dayjs.Dayjs} The dayjs object representing the given timestamp.
         */
        unixToDayjs(value) {
            return dayjs.unix(value).tz(this.timezone);
        },

        /**
         * Converts the given value to a dayjs object.
         * @param {string} value - the value to be converted
         * @returns {dayjs.Dayjs} a dayjs object in the timezone of this instance
         */
        toDayjs(value) {
            return dayjs.utc(value).tz(this.timezone);
        },

        /**
         * Get time for maintenance
         * @param {string | number | Date | dayjs.Dayjs} value Time to
         * format
         * @returns {string} Formatted string
         */
        datetimeMaintenance(value) {
            const inputDate = new Date(value);
            const now = new Date(Date.now());

            if (
                inputDate.getFullYear() === now.getUTCFullYear() &&
                inputDate.getMonth() === now.getUTCMonth() &&
                inputDate.getDay() === now.getUTCDay()
            ) {
                return this.formatInLocale(value, { hour: "2-digit", minute: "2-digit" });
            } else {
                return this.formatinLocale(value, {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            }
        },

        /**
         * Return a given value in the format YYYY-MM-DD
         * @param {any} value  Value to format as date
         * @returns {string} Formatted string
         */
        date(value) {
            return this.formatInLocale(value, options);
        },

        /**
         * Return a given value in the format HH:mm or if second is set
         * to true, HH:mm:ss
         * @param {any} value Value to format
         * @param {boolean} second Should seconds be included?
         * @returns {string} Formatted string
         */
        time(value, second = true) {
            const options = { hour: "2-digit", minute: "2-digit" };
            if (second) {
                options.second = "2-digit";
            }
            return this.formatInLocale(value, options);
        },

        /**
         * Return a value in a custom format
         * @param {any} value Value to format
         * @param {any} format Format to return value in
         * @returns {string} Formatted string
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
    },
};
