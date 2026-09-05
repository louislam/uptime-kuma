<template>
    <div v-if="!healthCheckStatus" id="health-check" class="d-flex flex-wrap py-3 mx-4">
        <div class="alert alert-danger w-100 d-inline-flex align-items-center justify-content-between">
            <div class="px-3">Monitoring is paused, the health check monitor is down!</div>
            <div>
                <router-link :to="monitorURL(healthCheckMonitor.id)" class="btn btn-danger text-nowrap">
                    View {{ healthCheckMonitor.name }}
                </router-link>
            </div>
        </div>
    </div>
</template>

<script>
import { UP } from "../util.ts";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    data() {
        return {
            settings: {},
        };
    },

    computed: {
        /**
         * Find the designated health check monitor from the monitor list
         * @returns {*|null} A monitor object if the health check monitor id is set
         */
        healthCheckMonitor() {
            const healthCheckMonitorId = this.settings?.healthCheckMonitorId;

            if (this.$root.monitorList[healthCheckMonitorId]) {
                return this.$root.monitorList[healthCheckMonitorId];
            }

            return null;
        },

        /**
         * Determines if the designated health check monitor is down
         * @returns {boolean} The health check monitor status
         */
        healthCheckStatus() {
            const healthCheckMonitorId = this.healthCheckMonitor?.id;

            if (
                healthCheckMonitorId in this.$root.lastHeartbeatList &&
                this.$root.lastHeartbeatList[healthCheckMonitorId]
            ) {
                return this.$root.lastHeartbeatList[healthCheckMonitorId].status === UP;
            }

            return true;
        },
    },

    mounted() {
        this.loadSettings();
    },

    methods: {
        /**
         * Load settings from server
         * @returns {void}
         */
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;
            });
        },

        /**
         * Get URL of monitor
         * @param {number} id ID of monitor
         * @returns {string} Relative URL of monitor
         */
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },
    },
};
</script>
