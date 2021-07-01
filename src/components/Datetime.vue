<template>
    <span>{{ displayText }}</span>
</template>

<script>
import dayjs from "dayjs";
import relativeTime  from "dayjs/plugin/relativeTime"
import utc  from 'dayjs/plugin/utc'
import timezone  from 'dayjs/plugin/timezone' // dependent on utc plugin
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

export default {
    props: {
        value: String,
    },

    computed: {
        displayText() {
            let format = "YYYY-MM-DD HH:mm:ss";
            return dayjs.utc(this.value).tz(this.$root.timezone).format(format)
        },
    }
}
</script>

<style scoped>

</style>
