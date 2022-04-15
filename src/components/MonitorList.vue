<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
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

            <router-link v-for="(item, index) in sortedMonitorList" :key="index" :to="monitorURL(item.id)" class="item" :class="{ 'disabled': ! item.active }">
                <div class="row">
                    <div class="col-9 col-md-8 small-padding" :class="{ 'monitor-item': $root.userHeartbeatBar == 'bottom' || $root.userHeartbeatBar == 'none' }">
                        <div class="info">
                            <Uptime :monitor="item" type="24" :pill="true" />
                            {{ item.name }}
                        </div>
                        <div class="tags">
                            <Tag v-for="tag in item.tags" :key="tag" :item="tag" :size="'sm'" />
                        </div>
                    </div>
                    <div v-show="$root.userHeartbeatBar == 'normal'" :key="$root.userHeartbeatBar" class="col-3 col-md-4">
                        <HeartbeatBar size="small" :monitor-id="item.id" />
                    </div>
                </div>

                <div v-if="$root.userHeartbeatBar == 'bottom'" class="row">
                    <div class="col-12 bottom-style">
                        <HeartbeatBar size="small" :monitor-id="item.id" />
                    </div>
                </div>
            </router-link>
        </div>
    </div>
</template>

<script>
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Uptime from "../components/Uptime.vue";
import Tag from "../components/Tag.vue";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    components: {
        Uptime,
        HeartbeatBar,
        Tag,
    },
    props: {
        scrollbar: {
            type: Boolean,
        },
    },
    data() {
        return {
            searchText: "",
            windowTop: 0,
        };
    },
    computed: {
        boxStyle() {
            return {
                height: `calc(100vh - 160px + ${this.windowTop}px)`,
            };
        },

        sortedMonitorList() {
            let result = Object.values(this.$root.monitorList);

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

            // Simple filter by search text
            // finds monitor name, tag name or tag value
            if (this.searchText != "") {
                const loweredSearchText = this.searchText.toLowerCase();
                result = result.filter(monitor => {
                    return monitor.name.toLowerCase().includes(loweredSearchText)
                    || monitor.tags.find(tag => tag.name.toLowerCase().includes(loweredSearchText)
                    || tag.value?.toLowerCase().includes(loweredSearchText));
                });
            }

            return result;
        },
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
    },
    methods: {
        onScroll() {
            if (window.top.scrollY <= 133) {
                this.windowTop = window.top.scrollY;
            } else {
                this.windowTop = 133;
            }
        },
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },
        clearSearchText() {
            this.searchText = "";
        }
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
    display: flex;
    justify-content: space-between;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.dark {
    .footer {
        //  background-color: $dark-bg;
    }
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
