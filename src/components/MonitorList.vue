<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
            <div class="header-top">
                <div class="placeholder"></div>
                <div class="search-wrapper">
                    <a v-if="searchText == ''" class="search-icon">
                        <font-awesome-icon icon="search" />
                    </a>
                    <a v-if="searchText != ''" class="search-icon" @click="clearSearchText">
                        <font-awesome-icon icon="times" />
                    </a>
                    <form>
                        <input
                            v-model="searchText" class="form-control search-input" :placeholder="$t('Search...')"
                            autocomplete="off"
                        />
                    </form>
                </div>
            </div>
            <div class="header-filter">
                <MonitorListFilter :filterState="filterState" @update-filter="updateFilter" />
            </div>
        </div>
        <div class="monitor-list" :class="{ scrollbar: scrollbar }">
            <div v-if="Object.keys($root.monitorList).length === 0" class="text-center mt-3">
                {{ $t("No Monitors, please") }} <router-link to="/add">{{ $t("add one") }}</router-link>
            </div>

            <MonitorListItem
                v-for="(item, index) in sortedMonitorList" :key="index" :monitor="item"
                :showPathName="filtersActive"
            />
        </div>
    </div>
</template>

<script>
import MonitorListItem from "../components/MonitorListItem.vue";
import MonitorListFilter from "./MonitorListFilter.vue";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    components: {
        MonitorListItem,
        MonitorListFilter,
    },
    props: {
        /** Should the scrollbar be shown */
        scrollbar: {
            type: Boolean,
        },
    },
    data() {
        return {
            searchText: "",
            windowTop: 0,
            filterState: {
                status: null,
                active: null,
                tags: null,
            }
        };
    },
    computed: {
        /**
         * Improve the sticky appearance of the list by increasing its
         * height as user scrolls down.
         * Not used on mobile.
         */
        boxStyle() {
            if (window.innerWidth > 550) {
                return {
                    height: `calc(100vh - 160px + ${this.windowTop}px)`,
                };
            } else {
                return {
                    height: "calc(100vh - 160px)",
                };
            }

        },

        /**
         * Returns a sorted list of monitors based on the applied filters and search text.
         *
         * @return {Array} The sorted list of monitors.
         */
        sortedMonitorList() {
            let result = Object.values(this.$root.monitorList);

            result = result.filter(monitor => {

                // filter by search text
                // finds monitor name, tag name or tag value
                let searchTextMatch = true;
                if (this.searchText !== "") {
                    const loweredSearchText = this.searchText.toLowerCase();
                    searchTextMatch =
                        monitor.name.toLowerCase().includes(loweredSearchText)
                        || monitor.tags.find(tag => tag.name.toLowerCase().includes(loweredSearchText)
                            || tag.value?.toLowerCase().includes(loweredSearchText));

                }

                // filter by status
                let statusMatch = true;
                if (this.filterState.status != null && this.filterState.status.length > 0) {
                    if (monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[monitor.id]) {
                        monitor.status = this.$root.lastHeartbeatList[monitor.id].status;
                    }
                    statusMatch = this.filterState.status.includes(monitor.status);
                }

                // filter by active
                let activeMatch = true;
                if (this.filterState.active != null && this.filterState.active.length > 0) {
                    activeMatch = this.filterState.active.includes(monitor.active);
                }

                // filter by tags
                let tagsMatch = true;
                if (this.filterState.tags != null && this.filterState.tags.length > 0) {
                    tagsMatch = monitor.tags.map(tag => tag.tag_id) // convert to array of tag IDs
                        .filter(monitorTagId => this.filterState.tags.includes(monitorTagId)) // perform Array Intersaction between filter and monitor's tags
                        .length > 0;
                }

                // Hide children if not filtering
                let showChild = true;
                if (this.filterState.status == null && this.filterState.active == null && this.filterState.tags == null && this.searchText === "") {
                    if (monitor.parent !== null) {
                        showChild = false;
                    }
                }

                return searchTextMatch && statusMatch && activeMatch && tagsMatch && showChild;
            });

            // Filter result by active state, weight and alphabetical
            result.sort((m1, m2) => {

                if (m1.active !== m2.active) {
                    if (m1.active === false) {
                        return 1;
                    }

                    if (m2.active === false) {
                        return -1;
                    }
                }

                if (m1.weight !== m2.weight) {
                    if (m1.weight > m2.weight) {
                        return -1;
                    }

                    if (m1.weight < m2.weight) {
                        return 1;
                    }
                }

                return m1.name.localeCompare(m2.name);
            });

            return result;
        },

        /**
         * Determines if any filters are active.
         *
         * @return {boolean} True if any filter is active, false otherwise.
         */
        filtersActive() {
            return this.filterState.status != null || this.filterState.active != null || this.filterState.tags != null || this.searchText !== "";
        }
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
    },
    methods: {
        /** Handle user scroll */
        onScroll() {
            if (window.top.scrollY <= 133) {
                this.windowTop = window.top.scrollY;
            } else {
                this.windowTop = 133;
            }
        },
        /**
         * Get URL of monitor
         * @param {number} id ID of monitor
         * @returns {string} Relative URL of monitor
         */
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },
        /** Clear the search bar */
        clearSearchText() {
            this.searchText = "";
        },
        /**
         * Update the MonitorList Filter
         * @param {object} newFilter Object with new filter
         */
        updateFilter(newFilter) {
            this.filterState = newFilter;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box {
    height: calc(100vh - 150px);
    position: sticky;
    top: 10px;
}

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.list-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin: -10px;
    margin-bottom: 10px;
    padding: 10px;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-filter {
    display: flex;
    align-items: center;
}

@media (max-width: 770px) {
    .list-header {
        margin: -20px;
        margin-bottom: 10px;
        padding: 5px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
}

.search-icon {
    padding: 10px;
    color: #c0c0c0;

    // Clear filter button (X)
    svg[data-icon="times"] {
        cursor: pointer;
        transition: all ease-in-out 0.1s;

        &:hover {
            opacity: 0.5;
        }
    }
}

.search-input {
    max-width: 15em;
}

.monitor-item {
    width: 100%;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.bottom-style {
    padding-left: 67px;
    margin-top: 5px;
}
</style>
