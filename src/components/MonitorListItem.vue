<template>
    <div>
        <router-link :to="monitorURL(monitor.id)" class="item" :class="{ 'disabled': ! monitor.active }">
            <div class="row">
                <div class="col-9 col-md-8 small-padding" :class="{ 'monitor-item': $root.userHeartbeatBar == 'bottom' || $root.userHeartbeatBar == 'none' }">
                    <div class="info" :style="depthMargin">
                        <Uptime :monitor="monitor" type="24" :pill="true" />
                        <span v-if="hasChildren" class="collapse-padding" @click.prevent="changeCollapsed">
                            <font-awesome-icon icon="chevron-down" class="animated" :class="{ collapsed: isCollapsed}" />
                        </span>
                        {{ monitorName }}
                    </div>
                    <div class="tags">
                        <Tag v-for="tag in monitor.tags" :key="tag" :item="tag" :size="'sm'" />
                    </div>
                </div>
                <div v-show="$root.userHeartbeatBar == 'normal'" :key="$root.userHeartbeatBar" class="col-3 col-md-4">
                    <HeartbeatBar size="small" :monitor-id="monitor.id" />
                </div>
            </div>

            <div v-if="$root.userHeartbeatBar == 'bottom'" class="row">
                <div class="col-12 bottom-style">
                    <HeartbeatBar size="small" :monitor-id="monitor.id" />
                </div>
            </div>
        </router-link>

        <transition name="slide-fade-up">
            <div v-if="!isCollapsed" class="childs">
                <MonitorListItem v-for="(item, index) in sortedChildMonitorList" :key="index" :monitor="item" :isSearch="isSearch" :depth="depth + 1" />
            </div>
        </transition>
    </div>
</template>

<script>
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Tag from "../components/Tag.vue";
import Uptime from "../components/Uptime.vue";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    name: "MonitorListItem",
    components: {
        Uptime,
        HeartbeatBar,
        Tag,
    },
    props: {
        /** Monitor this represents */
        monitor: {
            type: Object,
            default: null,
        },
        /** If the user is currently searching */
        isSearch: {
            type: Boolean,
            default: false,
        },
        /** How many ancestors are above this monitor */
        depth: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            isCollapsed: true,
        };
    },
    computed: {
        sortedChildMonitorList() {
            let result = Object.values(this.$root.monitorList);

            result = result.filter(childMonitor => childMonitor.parent === this.monitor.id);

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
        hasChildren() {
            return this.sortedChildMonitorList.length > 0;
        },
        depthMargin() {
            return {
                marginLeft: `${31 * this.depth}px`,
            };
        },
        monitorName() {
            if (this.isSearch) {
                return this.monitor.pathName;
            } else {
                return this.monitor.name;
            }
        }
    },
    beforeMount() {

        // Always unfold if monitor is accessed directly
        if (this.monitor.childrenIDs.includes(parseInt(this.$route.params.id))) {
            this.isCollapsed = false;
            return;
        }

        // Set collapsed value based on local storage
        let storage = window.localStorage.getItem("monitorCollapsed");
        if (storage === null) {
            return;
        }

        let storageObject = JSON.parse(storage);
        if (storageObject[`monitor_${this.monitor.id}`] == null) {
            return;
        }

        this.isCollapsed = storageObject[`monitor_${this.monitor.id}`];
    },
    methods: {
        /**
         * Changes the collapsed value of the current monitor and saves it to local storage
         */
        changeCollapsed() {
            this.isCollapsed = !this.isCollapsed;

            // Save collapsed value into local storage
            let storage = window.localStorage.getItem("monitorCollapsed");
            let storageObject = {};
            if (storage !== null) {
                storageObject = JSON.parse(storage);
            }
            storageObject[`monitor_${this.monitor.id}`] = this.isCollapsed;

            window.localStorage.setItem("monitorCollapsed", JSON.stringify(storageObject));
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

<style lang="scss" scoped>
@import "../assets/vars.scss";

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.collapse-padding {
    padding-left: 8px !important;
    padding-right: 2px !important;
}

// .monitor-item {
//     width: 100%;
// }

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.collapsed {
    transform: rotate(-90deg);
}

.animated {
    transition: all 0.2s $easing-in;
}

</style>
