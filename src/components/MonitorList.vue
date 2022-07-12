<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
            <div v-if="Object.keys($root.monitorList).length > 0" class="selection-controls">
                <template v-if="Object.keys(selectedMonitors).length === 0">
                    <input id="select-mode-btn" v-model="selectMode" type="checkbox" class="btn-check" autocomplete="off" :value="true">
                    <label class="btn btn-sm text-primary" for="select-mode-btn">{{ $t(selectMode ? "Cancel" : "Select") }}</label>
                    <button v-if="selectMode" class="btn btn-sm text-primary" type="button" @click="selectAll">Select All</button>
                </template>
                <div v-else class="dropdown">
                    <button id="selectionDropdownButton" class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        {{ $t("With Selected...") }}
                    </button>
                    <ul class="dropdown-menu" :class="{'dropdown-menu-dark': isDarkTheme}" aria-labelledby="selectionDropdownButton">
                        <li><a class="dropdown-item" href="#" @click="pauseDialog"><font-awesome-icon icon="pause" size="sm" /> {{ $t("Pause") }}</a></li>
                        <li><a class="dropdown-item" href="#" @click="resumeSelected"><font-awesome-icon icon="play" size="sm" /> {{ $t("Resume") }}</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" @click="cancelSelectMode">{{ $t("Cancel") }}</a></li>
                    </ul>
                </div>
            </div>
            <div class="placeholder"></div>
            <div class="search-wrapper">
                <a v-if="searchText == ''" class="search-icon">
                    <font-awesome-icon icon="search" />
                </a>
                <a v-if="searchText != ''" class="search-icon" @click="clearSearchText">
                    <font-awesome-icon icon="times" />
                </a>
                <form>
                    <input v-model="searchText" class="form-control search-input" :placeholder="$t('Search...')" autocomplete="off" />
                </form>
            </div>
        </div>
        <div class="monitor-list" :class="{ scrollbar: scrollbar }">
            <div v-if="Object.keys($root.monitorList).length === 0" class="text-center mt-3">
                {{ $t("No Monitors, please") }} <router-link to="/add">{{ $t("add one") }}</router-link>
            </div>

            <MonitorListItem
                v-for="(item, index) in sortedMonitorList"
                :key="index"
                :monitor="item"
                :isSearch="searchText !== ''"
                :isSelectMode="selectMode"
                :isSelected="isSelected"
                :select="select"
                :deselect="deselect"
            />
        </div>
    </div>

    <Confirm ref="confirmPause" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="pauseSelected">
        {{ $t("pauseMonitorMsg") }}
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import MonitorListItem from "../components/MonitorListItem.vue";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    components: {
        Confirm,
        MonitorListItem,
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
            selectMode: false,
            selectedMonitors: {},
            windowTop: 0,
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

        sortedMonitorList() {
            let result = Object.values(this.$root.monitorList);

            // Simple filter by search text
            // finds monitor name, tag name or tag value
            if (this.searchText !== "") {
                const loweredSearchText = this.searchText.toLowerCase();
                result = result.filter(monitor => {
                    return monitor.name.toLowerCase().includes(loweredSearchText)
                    || monitor.tags.find(tag => tag.name.toLowerCase().includes(loweredSearchText)
                    || tag.value?.toLowerCase().includes(loweredSearchText));
                });
            } else {
                result = result.filter(monitor => monitor.parent === null);
            }

            // Filter result by active state, weight and alphabetical
            result.sort((m1, m2) => {

                if (m1.active !== m2.active) {
                    if (m1.active === 0) {
                        return 1;
                    }

                    if (m2.active === 0) {
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

        isDarkTheme() {
            return document.body.classList.contains("dark");
        },
    },
    watch: {
        searchText() {
            this.cancelSelectMode();
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
        /** Select all monitors */
        selectAll() {
            this.selectedMonitors = {};
            Object.values(this.$root.monitorList).forEach((item) => {
                this.selectedMonitors[item.id] = true;
            });
        },
        /**
         * Deselect a monitor
         * @param {number} id ID of monitor
         */
        deselect(id) {
            delete this.selectedMonitors[id];
        },
        /**
         * Select a monitor
         * @param {number} id ID of monitor
         */
        select(id) {
            this.selectedMonitors[id] = true;
        },
        /**
         * Determine if monitor is selected
         * @param {number} id ID of monitor
         * @returns {bool}
         */
        isSelected(id) {
            return id in this.selectedMonitors;
        },
        /** Disable select mode and reset selection */
        cancelSelectMode() {
            this.selectMode = false;
            this.selectedMonitors = {};
        },
        /** Show dialog to confirm pause */
        pauseDialog() {
            this.$refs.confirmPause.show();
        },
        /** Pause each selected monitor */
        pauseSelected() {
            Object.keys(this.selectedMonitors)
                .filter(id => this.$root.monitorList[id].active)
                .forEach(id => this.$root.getSocket().emit("pauseMonitor", id));

            this.cancelSelectMode();
        },
        /** Resume each selected monitor */
        resumeSelected() {
            Object.keys(this.selectedMonitors)
                .filter(id => !this.$root.monitorList[id].active)
                .forEach(id => this.$root.getSocket().emit("resumeMonitor", id));

            this.cancelSelectMode();
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
    align-items: center;
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin: -10px;
    margin-bottom: 10px;
    padding: 10px;
    display: flex;
    justify-content: space-between;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }

    .dropdown-menu {
        padding-left: 0;
    }
}

@media (max-width: 770px) {
    .list-header {
        margin: -5px -15px 10px;
        padding: 5px;
    }
}

@media (min-width: 768px) and (max-width: 1450px) {
    .list-header {
        flex-wrap: wrap;
    }

    .selection-controls {
        flex: 1 0 100%;
        order: 999;
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

.selection-controls .btn {
    padding-left: 10px;
    padding-right: 10px;
}

.selection-controls .dropdown-item [data-icon] {
    margin-right: 6px;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

</style>
