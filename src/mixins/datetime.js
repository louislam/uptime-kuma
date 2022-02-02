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
        },

        groupTimesBy(list, timeParamName = 'createdDate') {
            let toReturn = {};

            for (let listItem of list) {
                const year = dayjs.utc(listItem[timeParamName]).tz(this.timezone).format("YYYY");
                const month = dayjs.utc(listItem[timeParamName]).tz(this.timezone).format("MM");

                if (toReturn[year] == null) {
                    toReturn[year] = {};
                }
                if (toReturn[year][month] == null) {
                    toReturn[year][month] = [];
                }

                toReturn[year][month].push(listItem);
            }

            return toReturn;
        },

        getMonthName(month) {
            return dayjs().month(month - 1).format("MMMM");
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
