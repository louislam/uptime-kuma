import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

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
        datetime(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD HH:mm:ss");
        },

        date(value) {
            return this.datetimeFormat(value, "YYYY-MM-DD");
        },

        time(value, second = true) {
            let secondString;
            if (second) {
                secondString = ":ss";
            } else {
                secondString = "";
            }
            return this.datetimeFormat(value, "HH:mm" + secondString);
        },

        datetimeFormat(value, format) {
            if (value !== undefined && value !== "") {
                return dayjs.utc(value).tz(this.timezone).format(format);
            }
            return "";
        }
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
