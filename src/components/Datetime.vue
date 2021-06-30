<template>
    <span>{{ displayText }}</span>
</template>

<script>
import dayjs from "dayjs";
import relativeTime  from "dayjs/plugin/relativeTime"
dayjs.extend(relativeTime)

export default {
    props: {
        value: String,
    },

    computed: {
        displayText() {
            return this.value
        },
    }
}
</script>

<style scoped>

</style>
