<template>
    <span :class="className">{{ uptime }}</span>
</template>

<script>
export default {
    props: {
        monitor : Object,
        type: String,
        pill: {
            Boolean,
            default: false,
        },
    },

    computed: {
        uptime() {

            let key = this.monitor.id + "_" + this.type;

            if (this.$root.uptimeList[key]) {
                return Math.round(this.$root.uptimeList[key] * 10000) / 100 + "%";
            } else {
                return "N/A"
            }
        },

        color() {
            if (this.lastHeartBeat.status === 0) {
                return "danger"
            } else if (this.lastHeartBeat.status === 1) {
                return "primary"
            } else {
                return "secondary"
            }
        },

        lastHeartBeat() {
            if (this.monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[this.monitor.id]) {
                return this.$root.lastHeartbeatList[this.monitor.id]
            } else {
                return { status: -1 }
            }
        },

        className() {
            if (this.pill) {
                return `badge rounded-pill bg-${this.color}`;
            } else {
                return "";
            }
        },

    },

}
</script>

<style scoped>

</style>
