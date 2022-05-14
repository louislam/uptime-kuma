<template>
    <span :class="className" :title="24 + $t('-hour')">{{ uptime }}</span>
</template>

<script>
export default {
    props: {
        monitor: {
            type: Object,
            default: null,
        },
        type: {
            type: String,
            default: null,
        },
        pill: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        uptime() {

            let key = this.monitor.id + "_" + this.type;

            if (this.$root.uptimeList[key] !== undefined) {
                return Math.round(this.$root.uptimeList[key] * 10000) / 100 + "%";
            }

            return this.$t("notAvailableShort");
        },

        color() {
            if (this.lastHeartBeat.status === 0) {
                return "danger";
            }

            if (this.lastHeartBeat.status === 1) {
                return "primary";
            }

            if (this.lastHeartBeat.status === 2) {
                return "warning";
            }

            return "secondary";
        },

        lastHeartBeat() {
            if (this.monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[this.monitor.id]) {
                return this.$root.lastHeartbeatList[this.monitor.id];
            }

            return {
                status: -1,
            };
        },

        className() {
            if (this.pill) {
                return `badge rounded-pill bg-${this.color}`;
            }

            return "";
        },
    },
};
</script>

<style>
.badge {
    min-width: 62px;
}
</style>
