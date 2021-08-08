<template>
    <span>{{ displayText }}</span>
</template>

<script>
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone" // dependent on utc plugin
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

export default {
    props: {
        value: String,
        dateOnly: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        displayText() {
            if (this.value !== undefined && this.value !== "") {
                let format = "YYYY-MM-DD HH:mm:ss";
                if (this.dateOnly) {
                    format = "YYYY-MM-DD";
                }
                return dayjs.utc(this.value).tz(this.$root.timezone).format(format);
            }

            return "";
        },
    },
}
</script>
