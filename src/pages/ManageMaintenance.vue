<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Maintenance") }}
            </h1>

            <div>
                <router-link to="/add-maintenance" class="btn btn-primary mb-3">
                    <font-awesome-icon icon="plus" /> {{ $t("Schedule Maintenance") }}
                </router-link>
            </div>

            <div class="shadow-box">
                <span v-if="Object.keys(sortedMaintenanceList).length === 0" class="d-flex align-items-center justify-content-center my-3">
                    {{ $t("No Maintenance") }}
                </span>

                <div
                    v-for="(item, index) in sortedMaintenanceList"
                    :key="index"
                    class="item"
                    :class="item.status"
                >
                    <div class="left-part">
                        <div
                            class="circle"
                        ></div>
                        <div class="info">
                            <div class="title">{{ item.title }}</div>
                            <div v-if="false">{{ item.description }}</div>
                            <div class="status">
                                {{ $t("maintenanceStatus-" + item.status) }}
                            </div>

                            <MaintenanceTime :maintenance="item" />
                        </div>
                    </div>

                    <div class="buttons">
                        <router-link v-if="false" :to="maintenanceURL(item.id)" class="btn btn-light">{{ $t("Details") }}</router-link>

                        <div class="btn-group" role="group">
                            <button v-if="item.active" class="btn btn-normal" @click="pauseDialog(item.id)">
                                <font-awesome-icon icon="pause" /> {{ $t("Pause") }}
                            </button>

                            <button v-if="!item.active" class="btn btn-primary" @click="resumeMaintenance(item.id)">
                                <font-awesome-icon icon="play" /> {{ $t("Resume") }}
                            </button>

                            <router-link :to="'/maintenance/edit/' + item.id" class="btn btn-normal">
                                <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                            </router-link>

                            <button class="btn btn-normal text-danger" @click="deleteDialog(item.id)">
                                <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-center mt-3" style="font-size: 13px;">
                <a href="https://github.com/louislam/uptime-kuma/wiki/Maintenance" target="_blank">{{ $t("Learn More") }}</a>
            </div>

            <Confirm ref="confirmPause" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="pauseMaintenance">
                {{ $t("pauseMaintenanceMsg") }}
            </Confirm>

            <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteMaintenance">
                {{ $t("deleteMaintenanceMsg") }}
            </Confirm>
        </div>
    </transition>
</template>

<script>
import { getResBaseURL } from "../util-frontend";
import { getMaintenanceRelativeURL } from "../util.ts";
import Confirm from "../components/Confirm.vue";
import MaintenanceTime from "../components/MaintenanceTime.vue";

export default {
    components: {
        MaintenanceTime,
        Confirm,
    },
    data() {
        return {
            selectedMaintenanceID: undefined,
            statusOrderList: {
                "under-maintenance": 1000,
                "scheduled": 900,
                "inactive": 800,
                "ended": 700,
                "unknown": 0,
            }
        };
    },
    computed: {
        sortedMaintenanceList() {
            let result = Object.values(this.$root.maintenanceList);

            result.sort((m1, m2) => {
                if (this.statusOrderList[m1.status] === this.statusOrderList[m2.status]) {
                    return m1.title.localeCompare(m2.title);
                } else {
                    return this.statusOrderList[m1.status] < this.statusOrderList[m2.status];
                }
            });

            return result;
        },
    },
    mounted() {

    },
    methods: {
        /**
         * Get the correct URL for the icon
         * @param {string} icon Path for icon
         * @returns {string} Correctly formatted path including port numbers
         */
        icon(icon) {
            if (icon === "/icon.svg") {
                return icon;
            } else {
                return getResBaseURL() + icon;
            }
        },

        /**
         * Get maintenance URL
         * @param {number} id ID of maintenance to read
         * @returns {string} Relative URL
         */
        maintenanceURL(id) {
            return getMaintenanceRelativeURL(id);
        },

        /**
         * Show delete confirmation
         * @param {number} maintenanceID ID of maintenance to show delete
         * confirmation for.
         * @returns {void}
         */
        deleteDialog(maintenanceID) {
            this.selectedMaintenanceID = maintenanceID;
            this.$refs.confirmDelete.show();
        },

        /**
         * Delete maintenance after showing confirmation dialog
         * @returns {void}
         */
        deleteMaintenance() {
            this.$root.deleteMaintenance(this.selectedMaintenanceID, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/maintenance");
                }
            });
        },

        /**
         * Show dialog to confirm pause
         * @param {number} maintenanceID ID of maintenance to confirm
         * pause.
         * @returns {void}
         */
        pauseDialog(maintenanceID) {
            this.selectedMaintenanceID = maintenanceID;
            this.$refs.confirmPause.show();
        },

        /**
         * Pause maintenance
         * @returns {void}
         */
        pauseMaintenance() {
            this.$root.getSocket().emit("pauseMaintenance", this.selectedMaintenanceID, (res) => {
                this.$root.toastRes(res);
            });
        },

        /**
         * Resume maintenance
         * @param {number} id ID of maintenance to resume
         * @returns {void}
         */
        resumeMaintenance(id) {
            this.$root.getSocket().emit("resumeMaintenance", id, (res) => {
                this.$root.toastRes(res);
            });
        },
    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";

    .mobile {
        .item {
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 20px;
        }
    }

    .item {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        border-radius: 10px;
        transition: all ease-in-out 0.15s;
        justify-content: space-between;
        padding: 10px;
        min-height: 90px;
        margin-bottom: 5px;

        &:hover {
            background-color: $highlight-white;
        }

        &.under-maintenance {
            background-color: rgba(23, 71, 245, 0.16);

            &:hover {
                background-color: rgba(23, 71, 245, 0.3) !important;
            }

            .circle {
                background-color: $maintenance;
            }
        }

        &.scheduled {
            .circle {
                background-color: $primary;
            }
        }

        &.inactive {
            .circle {
                background-color: $danger;
            }
        }

        &.ended {
            .left-part {
                opacity: 0.3;
            }

            .circle {
                background-color: $dark-font-color;
            }
        }

        &.unknown {
            .circle {
                background-color: $dark-font-color;
            }
        }

        .left-part {
            display: flex;
            gap: 12px;
            align-items: center;

            .circle {
                width: 25px;
                height: 25px;
                border-radius: 50rem;
            }

            .info {
                .title {
                    font-weight: bold;
                    font-size: 20px;
                }

                .status {
                    font-size: 14px;
                }
            }
        }

        .buttons {
            display: flex;
            gap: 8px;
            flex-direction: row-reverse;

            @media (max-width: 550px) {
                & {
                    width: 100%;
                }

                .btn-group {
                    margin: 1em 1em 0 1em;
                    width: 100%;
                }
            }
        }
    }

    .dark {
        .item {
            &:hover {
                background-color: $dark-bg2;
            }
        }
    }
</style>
