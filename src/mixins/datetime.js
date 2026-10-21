import dayjs from "dayjs";

/**
 * Display formats previously expressed as dayjs tokens.
 * `$d` from vue-i18n applies the active locale to these Intl options.
 * @type {Record<string, Intl.DateTimeFormatOptions>}
 */
const intlDateTimeFormats = {
    "YYYY-MM-DD HH:mm:ss": {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    },
    "YYYY-MM-DD HH:mm": {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    },
    "YYYY-MM-DD": {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    },
    "HH:mm:ss": {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    },
    "HH:mm": {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    },
};

/**
 * App locales that are not valid Intl locale tags.
 * @param {string} locale vue-i18n locale
 * @returns {string} Locale accepted by Intl.DateTimeFormat
 */
function intlLocale(locale) {
    const aliases = {
        bar: "de-DE",
        yue: "zh-HK",
        "sr-latn": "sr-Latn",
        ge: "ka",
    };
    const candidate = aliases[locale] || locale || "en";
    try {
        if (Intl.DateTimeFormat.supportedLocalesOf(candidate).length > 0) {
            return candidate;
        }
    } catch {
        // Invalid BCP 47 tag.
    }
    return "en";
}

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
         * Return a given value as a localized date and time
         * @param {any} value Value to format as date time
         * @returns {string} Formatted string
         */
        datetime(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD HH:mm:ss");
        },

        /**
         * Converts a Unix timestamp to a formatted date and time string.
         * @param {number} value - The Unix timestamp to convert.
         * @returns {string} The formatted date and time string.
         */
        unixToDateTime(value) {
            return this.datetime(dayjs.unix(value));
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
                inputDate.getMonth() ===now.getUTCMonth() &&
                inputDate.getDay() === now.getUTCDay()
            ) {
                return this.datetimeFormat(value, "HH:mm");
            } else {
                return this.datetimeFormat(value, "YYYY-MM-DD HH:mm");
            }
        },

        /**
         * Return a given value as a localized date
         * @param {any} value  Value to format as date
         * @returns {string} Formatted string
         */
        date(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD");
        },

        /**
         * Return a given value as a localized time. Seconds are included
         * unless `second` is false.
         * @param {any} value Value to format
         * @param {boolean} second Should seconds be included?
         * @returns {string} Formatted string
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
         * @returns {string} Formatted string
         */
        datetimeFormat(value, format) {
            if (value !== undefined && value !== "") {
                const options = intlDateTimeFormats[format];
                // Values such as datetime-local inputs must stay machine-readable.
                if (!options) {
                    return dayjs.utc(value).tz(this.timezone).format(format);
                }
                const date = dayjs.utc(value).toDate();
                if (Number.isNaN(date.getTime())) {
                    return "";
                }
                return this.$d(date, {
                    ...options,
                    timeZone: this.timezone,
                    locale: intlLocale(this.$i18n.locale),
                });
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