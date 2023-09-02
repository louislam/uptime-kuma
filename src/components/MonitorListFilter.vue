<template>
    <div class="px-2 pt-2 d-flex">
        <button
            type="button"
            :title="$t('Clear current filters')"
            class="clear-filters-btn btn"
            :class="{ 'active': numFiltersActive > 0}"
            tabindex="0"
            :disabled="numFiltersActive === 0"
            @click="clearFilters"
        >
            <font-awesome-icon icon="stream" />
            <span v-if="numFiltersActive > 0" class="px-1 fw-bold">{{ numFiltersActive }}</span>
            <font-awesome-icon v-if="numFiltersActive > 0" icon="times" />
        </button>
        <MonitorListFilterDropdown
            :filterActive="filterState.status?.length > 0"
        >
            <template #status>
                <Status v-if="filterState.status?.length === 1" :status="filterState.status[0]" />
                <span v-else>
                    {{ $t('Status') }}
                </span>
            </template>
            <template #dropdown>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleStatusFilter(1)">
                        <div class="d-flex align-items-center justify-content-between">
                            <Status :status="1" />
                            <span class="ps-3">
                                {{ $root.stats.up }}
                                <span v-if="filterState.status?.includes(1)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleStatusFilter(0)">
                        <div class="d-flex align-items-center justify-content-between">
                            <Status :status="0" />
                            <span class="ps-3">
                                {{ $root.stats.down }}
                                <span v-if="filterState.status?.includes(0)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleStatusFilter(2)">
                        <div class="d-flex align-items-center justify-content-between">
                            <Status :status="2" />
                            <span class="ps-3">
                                {{ $root.stats.pending }}
                                <span v-if="filterState.status?.includes(2)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleStatusFilter(3)">
                        <div class="d-flex align-items-center justify-content-between">
                            <Status :status="3" />
                            <span class="ps-3">
                                {{ $root.stats.maintenance }}
                                <span v-if="filterState.status?.includes(3)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
            </template>
        </MonitorListFilterDropdown>
        <MonitorListFilterDropdown :filterActive="filterState.active?.length > 0">
            <template #status>
                <span v-if="filterState.active?.length === 1">
                    <span v-if="filterState.active[0]">{{ $t("Running") }}</span>
                    <span v-else>{{ $t("filterActivePaused") }}</span>
                </span>
                <span v-else>
                    {{ $t("filterActive") }}
                </span>
            </template>
            <template #dropdown>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleActiveFilter(true)">
                        <div class="d-flex align-items-center justify-content-between">
                            <span>{{ $t("Running") }}</span>
                            <span class="ps-3">
                                {{ $root.stats.active }}
                                <span v-if="filterState.active?.includes(true)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
                <li>
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleActiveFilter(false)">
                        <div class="d-flex align-items-center justify-content-between">
                            <span>{{ $t("filterActivePaused") }}</span>
                            <span class="ps-3">
                                {{ $root.stats.pause }}
                                <span v-if="filterState.active?.includes(false)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
            </template>
        </MonitorListFilterDropdown>
        <MonitorListFilterDropdown :filterActive="filterState.tags?.length > 0">
            <template #status>
                <Tag
                    v-if="filterState.tags?.length === 1"
                    :item="tagsList.find(tag => tag.id === filterState.tags[0])"
                    :size="'sm'"
                />
                <span v-else>
                    {{ $t('Tags') }}
                </span>
            </template>
            <template #dropdown>
                <li v-for="tag in tagsList" :key="tag.id">
                    <div class="dropdown-item" tabindex="0" @click.stop="toggleTagFilter(tag)">
                        <div class="d-flex align-items-center justify-content-between">
                            <span><Tag :item="tag" :size="'sm'" /></span>
                            <span class="ps-3">
                                {{ getTaggedMonitorCount(tag) }}
                                <span v-if="filterState.tags?.includes(tag.id)" class="px-1 filter-active">
                                    <font-awesome-icon icon="check" />
                                </span>
                            </span>
                        </div>
                    </div>
                </li>
                <li v-if="tagsList.length === 0">
                    <div class="dropdown-item disabled px-3">
                        {{ $t('No tags found.') }}
                    </div>
                </li>
            </template>
        </MonitorListFilterDropdown>
    </div>
</template>

<script>
import MonitorListFilterDropdown from "./MonitorListFilterDropdown.vue";
import Status from "./Status.vue";
import Tag from "./Tag.vue";

export default {
    components: {
        MonitorListFilterDropdown,
        Status,
        Tag,
    },
    props: {
        filterState: {
            type: Object,
            required: true,
        }
    },
    emits: [ "updateFilter" ],
    data() {
        return {
            tagsList: [],
        };
    },
    computed: {
        numFiltersActive() {
            let num = 0;

            Object.values(this.filterState).forEach(item => {
                if (item != null && item.length > 0) {
                    num += 1;
                }
            });

            return num;
        }
    },
    mounted() {
        this.getExistingTags();
    },
    methods: {
        toggleStatusFilter(status) {
            let newFilter = {
                ...this.filterState
            };

            if (newFilter.status == null) {
                newFilter.status = [ status ];
            } else {
                if (newFilter.status.includes(status)) {
                    newFilter.status = newFilter.status.filter(item => item !== status);
                } else {
                    newFilter.status.push(status);
                }
            }
            this.$emit("updateFilter", newFilter);
        },
        toggleActiveFilter(active) {
            let newFilter = {
                ...this.filterState
            };

            if (newFilter.active == null) {
                newFilter.active = [ active ];
            } else {
                if (newFilter.active.includes(active)) {
                    newFilter.active = newFilter.active.filter(item => item !== active);
                } else {
                    newFilter.active.push(active);
                }
            }
            this.$emit("updateFilter", newFilter);
        },
        toggleTagFilter(tag) {
            let newFilter = {
                ...this.filterState
            };

            if (newFilter.tags == null) {
                newFilter.tags = [ tag.id ];
            } else {
                if (newFilter.tags.includes(tag.id)) {
                    newFilter.tags = newFilter.tags.filter(item => item !== tag.id);
                } else {
                    newFilter.tags.push(tag.id);
                }
            }
            this.$emit("updateFilter", newFilter);
        },
        clearFilters() {
            this.$emit("updateFilter", {
                status: null,
            });
        },
        getExistingTags() {
            this.$root.getSocket().emit("getTags", (res) => {
                if (res.ok) {
                    this.tagsList = res.tags;
                }
            });
        },
        getTaggedMonitorCount(tag) {
            return Object.values(this.$root.monitorList).filter(monitor => {
                return monitor.tags.find(monitorTag => monitorTag.tag_id === tag.id);
            }).length;
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dropdown-item {
    cursor: pointer;
}

.clear-filters-btn {
    font-size: 0.8em;
    margin-right: 5px;
    display: flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 16px;
    background-color: transparent;

    .dark & {
        color: $dark-font-color;
        border: 1px solid $dark-font-color2;
    }

    &.active {
        border: 1px solid $highlight;
        background-color: $highlight-white;

        .dark & {
            background-color: $dark-font-color2;
        }
    }
}
</style>
