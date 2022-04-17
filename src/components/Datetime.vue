<template>
    <span>{{ displayText }}</span>
</template>

<script>
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone"; // dependent on utc plugin
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

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
            if (this.dateOnly) {
                return this.$root.date(this.value);
            } else {
                return this.$root.datetime(this.value);
            }
        },
    },
};
</script>
