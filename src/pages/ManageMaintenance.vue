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

                <router-link
                    v-for="(item, index) in sortedMaintenanceList"
                    :key="index"
                    :to="maintenanceURL(item.id)"
                    class="item"
                    :class="{ 'disabled': !$root.isActiveMaintenance(item.end_date) }"
                >
                    <div>
                    </div>
                    <div class="info">
                        <div class="title">{{ item.title }}</div>
                        <div>{{ item.description }}</div>
                    </div>
                </router-link>
            </div>
        </div>
    </transition>
</template>

<script>
import { getResBaseURL } from "../util-frontend";
import { getMaintenanceRelativeURL } from "../util.ts";

export default {
    components: {
    },
    data() {
        return {
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
        padding: 10px;
        min-height: 90px;

        &:hover {
            background-color: $highlight-white;
        }

        &.active {
            background-color: #cdf8f4;
        }

        $logo-width: 70px;

        .logo {
            width: $logo-width;
            height: $logo-width;

            // Better when the image is loading
            min-height: 1px;
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

    .dark {
        .item {
            &:hover {
                background-color: $dark-bg2;
            }

            &.active {
                background-color: $dark-bg2;
            }
        }
    }
</style>
