<template>
    <span>{{ displayText }}</span>
</template>

<script>
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone"; // dependent on utc plugin
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export default {
    props: {
        value: {
            type: String,
            default: null,
        },
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
