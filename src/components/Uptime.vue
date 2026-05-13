<template>
    <span :class="className" :title="title">{{ uptime }}</span>
</template>

<script>
import { DOWN, MAINTENANCE, PENDING, UP } from "../util.ts";
import groupStatus from "../util/group-status";

const { calculateGroupStatus, calculateGroupUptime, getGroupChildMonitors } = groupStatus;

export default {
    props: {
        /** Monitor this represents */
        monitor: {
            type: Object,
            default: null,
        },
        /** Type of monitor */
        type: {
            type: String,
            default: null,
        },
        /** Is this a pill? */
        pill: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        uptime() {
            if (this.type === "maintenance") {
                return this.$t("statusMaintenance");
            }

            if (this.isGroupMonitor) {
                const groupUptime = calculateGroupUptime(this.groupChildMonitors, this.$root.uptimeList, this.type);

                if (groupUptime !== null) {
                    let result = Math.round(groupUptime * 10000) / 100;

                    if (this.$route.path.startsWith("/status") && result > 100) {
                        return "100%";
                    }

                    return result + "%";
                }

                return this.$t("notAvailableShort");
            }

            let key = this.monitor.id + "_" + this.type;

            if (this.$root.uptimeList[key] !== undefined) {
                let result = Math.round(this.$root.uptimeList[key] * 10000) / 100;
                // Only perform sanity check on status page. See louislam/uptime-kuma#2628
                if (this.$route.path.startsWith("/status") && result > 100) {
                    return "100%";
                } else {
                    return result + "%";
                }
            }

            return this.$t("notAvailableShort");
        },

        color() {
            const status = this.lastHeartBeat.status;

            if (status === MAINTENANCE) {
                return "maintenance";
            }

            if (status === DOWN) {
                return "danger";
            }

            if (status === UP) {
                return "primary";
            }

            if (status === PENDING) {
                return "warning";
            }

            return "secondary";
        },

        lastHeartBeat() {
            if (this.isGroupMonitor) {
                return {
                    status: calculateGroupStatus(this.groupChildMonitors, this.$root.heartbeatList),
                };
            }

            if (this.monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[this.monitor.id]) {
                return this.$root.lastHeartbeatList[this.monitor.id];
            }

            return {
                status: -1,
            };
        },

        isGroupMonitor() {
            return this.monitor?.type === "group";
        },

        groupChildMonitors() {
            if (!this.isGroupMonitor) {
                return [];
            }

            return getGroupChildMonitors(this.monitor, this.$root.monitorList);
        },

        className() {
            if (this.pill) {
                return `badge rounded-pill bg-${this.color}`;
            }

            return "";
        },

        title() {
            if (this.type === "1y") {
                return this.$t("years", 1);
            }
            if (this.type === "720") {
                return this.$t("days", 30);
            }
            return this.$t("hours", 24);
        },
    },
};
</script>

<style>
.badge {
    min-width: 62px;
}
</style>
