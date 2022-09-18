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
                    {{ $t("No maintenance") }}
                </span>

                <div
                    v-for="(item, index) in sortedMaintenanceList"
                    :key="index"
                    class="item"
                    :class="{ 'ended': !$root.isActiveMaintenance(item.end_date) }"
                >
                    <div class="left-part">
                        <div
                            class="circle"
                        ></div>
                        <div class="info">
                            <div class="title">{{ item.title }}</div>
                            <div>{{ item.description }}</div>
                        </div>
                    </div>

                    <div class="buttons">
                        <router-link v-if="false" :to="maintenanceURL(item.id)" class="btn btn-light">{{ $t("Details") }}</router-link>
                        <router-link :to="'/maintenance/edit/' + item.id" class="btn btn-secondary">
                            <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                        </router-link>
                        <button class="btn btn-danger" @click="deleteDialog(item.id)">
                            <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                        </button>
                    </div>
                </div>
            </div>

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
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            selectedMaintenanceID: undefined,
        };
    },
    computed: {
        sortedMaintenanceList() {
            let result = Object.values(this.$root.maintenanceList);

            result.sort((m1, m2) => {

                if (this.$root.isActiveMaintenance(m1.end_date) !== this.$root.isActiveMaintenance(m2.end_date)) {
                    if (!this.$root.isActiveMaintenance(m2.end_date)) {
                        return -1;
                    }
                    if (!this.$root.isActiveMaintenance(m1.end_date)) {
                        return 1;
                    }
                }

                if (this.$root.isActiveMaintenance(m1.end_date) && this.$root.isActiveMaintenance(m2.end_date)) {
                    if (Date.parse(m1.end_date) < Date.parse(m2.end_date)) {
                        return -1;
                    }

                    if (Date.parse(m2.end_date) < Date.parse(m1.end_date)) {
                        return 1;
                    }
                }

                if (!this.$root.isActiveMaintenance(m1.end_date) && !this.$root.isActiveMaintenance(m2.end_date)) {
                    if (Date.parse(m1.end_date) < Date.parse(m2.end_date)) {
                        return 1;
                    }

                    if (Date.parse(m2.end_date) < Date.parse(m1.end_date)) {
                        return -1;
                    }
                }

                return m1.title.localeCompare(m2.title);
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

        maintenanceURL(id) {
            return getMaintenanceRelativeURL(id);
        },

        deleteDialog(maintenanceID) {
            this.selectedMaintenanceID = maintenanceID;
            this.$refs.confirmDelete.show();
        },

        deleteMaintenance() {
            this.$root.deleteMaintenance(this.selectedMaintenanceID, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/maintenance");
                } else {
                    toast.error(res.msg);
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";

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

        &:hover {
            background-color: $highlight-white;
        }

        &.ended {
            .left-part {
                opacity: 0.5;

                .circle {
                    background-color: $dark-font-color;
                }
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
                background-color: $maintenance;
            }

            .info {
                .title {
                    font-weight: bold;
                    font-size: 20px;
                }

                .slug {
                    font-size: 14px;
                }
            }
        }

        .buttons {
            display: flex;
            gap: 8px;
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
