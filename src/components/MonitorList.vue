<template>
    <div class="shadow-box mb-3">
        <div class="list-header">
            <div class="search-wrapper float-start" style="margin-left: 5px;">
                <font-awesome-icon icon="filter" />
                <select v-model="selectedList" class="form-control" style="margin-left: 5px">
                    <option value="monitors" selected>{{$t('Monitors')}}</option>
                    <option value="incidents" selected>{{$t('Incidents')}}</option>
                </select>
            </div>
            <div class="search-wrapper">
                <a v-if="searchText == ''" class="search-icon">
                    <font-awesome-icon icon="search" />
                </a>
                <a v-if="searchText != ''" class="search-icon" @click="clearSearchText">
                    <font-awesome-icon icon="times" />
                </a>
                <input v-model="searchText" class="form-control search-input" :placeholder="$t('Search...')" />
            </div>
        </div>
        <div class="monitor-list" :class="{ scrollbar: scrollbar }">
            <div v-if="Object.keys($root.monitorList).length === 0 && selectedList === 'monitors'" class="text-center mt-3">
                {{ $t("No Monitors, please") }} <router-link to="/addMonitor">{{ $t("add one") }}</router-link>
            </div>
            <div v-if="Object.keys($root.incidentList).length === 0 && selectedList === 'incidents'" class="text-center mt-3">
                {{ $t("No Incidents, please") }} <router-link to="/addIncident">{{ $t("add one") }}</router-link>
            </div>

            <router-link v-if="selectedList === 'monitors'" v-for="(item, index) in sortedMonitorList" :key="index" :to="monitorURL(item.id)" class="item" :class="{ 'disabled': ! item.active }">
                <div class="row">
                    <div class="col-9 col-md-8 small-padding" :class="{ 'monitorItem': $root.userHeartbeatBar == 'bottom' || $root.userHeartbeatBar == 'none' }">
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
                    <div class="col-12">
                        <HeartbeatBar size="small" :monitor-id="item.id" />
                    </div>
                </div>
            </router-link>
            <router-link v-if="selectedList === 'incidents'" v-for="(item, index) in sortedIncidentList" :key="index" :to="incidentURL(item.id)" class="item" :class="{ 'disabled': item.resolved }">
                <div class="row">
                    <div class="col-9 col-md-8 small-padding">
                        <div class="info incident-info">
                            <font-awesome-icon v-if="item.resolved" icon="check-circle"
                                               class="incident-icon incident-bg-resolved"/>
                            <font-awesome-icon v-else-if="item.style === 'info'" icon="info-circle"
                                               class="incident-icon incident-bg-info"/>
                            <font-awesome-icon v-else-if="item.style === 'warning'"
                                               icon="exclamation-triangle"
                                               class="incident-icon incident-bg-warning"/>
                            <font-awesome-icon v-else-if="item.style === 'critical'" icon="exclamation-circle"
                                               class="incident-icon incident-bg-danger"/>
                            {{ item.title }}
                        </div>
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
import { getMonitorRelativeURL, getIncidentRelativeURL } from "../util.ts";

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
            selectedList: "monitors",
        };
    },
    computed: {
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
        sortedIncidentList() {
            let result = Object.values(this.$root.incidentList);

            result.sort((i1, i2) => {

                if (i1.resolved !== i2.resolved) {
                    if (i1.resolved) {
                        return 1;
                    }

                    if (i2.resolved) {
                        return -1;
                    }
                }

                else {
                    if (Date.parse(i1.createdDate) > Date.parse(i2.createdDate)) {
                        return -1;
                    }

                    if (Date.parse(i2.createdDate) < Date.parse(i1.createdDate)) {
                        return 1;
                    }
                }

                return i1.title.localeCompare(i2.title);
            });

            // Simple filter by search text
            // finds monitor name, tag name or tag value
            if (this.searchText != "") {
                const loweredSearchText = this.searchText.toLowerCase();
                result = result.filter(incident => {
                    return incident.name.toLowerCase().includes(loweredSearchText)
                        || incident.description.toLowerCase().includes(loweredSearchText)
                });
            }

            return result;
        },
    },
    methods: {
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },
        incidentURL(id) {
            return getIncidentRelativeURL(id);
        },
        clearSearchText() {
            this.searchText = "";
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

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

.monitorItem {
    width: 100%;
}

.tags {
    padding-left: 62px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

select {
    text-align: center;
}

.incident-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    column-gap: 10px;
}

.incident-bg-resolved {
    color: rgba(84, 220, 53, 0.52);
}

.incident-bg-info {
    color: rgba(53, 162, 220, 0.52);
}

.incident-bg-warning {
    color: rgba(255, 165, 0, 0.52);
}

.incident-bg-danger {
    color: #dc354585;
}

.incident-icon {
    font-size: 20px;
    vertical-align: middle;
}
</style>
