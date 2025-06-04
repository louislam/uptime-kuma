<template>
    <!-- Group List -->
    <Draggable
        v-model="$root.publicGroupList"
        :disabled="!editMode"
        item-key="id"
        :animation="100"
    >
        <template #item="group">
            <div class="mb-5" data-testid="group">
                <!-- Group Title -->
                <h2 class="group-title">
                    <div class="title-section">
                        <font-awesome-icon v-if="editMode && showGroupDrag" icon="arrows-alt-v" class="action drag me-3" />
                        <font-awesome-icon v-if="editMode" icon="times" class="action remove me-3" @click="removeGroup(group.index)" />
                        <Editable v-model="group.element.name" :contenteditable="editMode" tag="span" data-testid="group-name" />
                    </div>

                    <div v-if="group.element && group.element.monitorList && group.element.monitorList.length > 1" class="sort-dropdown">
                        <div class="dropdown">
                            <button :id="'sortDropdown' + group.index" type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle sort-button"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                    :aria-label="$t('Sort options')"
                                    :title="$t('Sort options')">
                                <div class="sort-arrows">
                                    <font-awesome-icon
                                        icon="arrow-down"
                                        :class="{
                                            'arrow-inactive': !group.element.sortKey || group.element.sortDirection !== 'desc',
                                            'arrow-active': group.element.sortKey && group.element.sortDirection === 'desc'
                                        }"
                                    />
                                    <font-awesome-icon
                                        icon="arrow-up"
                                        :class="{
                                            'arrow-inactive': !group.element.sortKey || group.element.sortDirection !== 'asc',
                                            'arrow-active': group.element.sortKey && group.element.sortDirection === 'asc'
                                        }"
                                    />
                                </div>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end sort-menu" :aria-labelledby="'sortDropdown' + group.index">
                                <li>
                                    <button class="dropdown-item sort-item" type="button" @click="setSort(group.element, 'status')"
                                            :aria-label="$t('Sort by status')"
                                            :title="$t('Sort by status')">
                                        <div class="sort-item-content">
                                            <span>{{ $t("Status") }}</span>
                                            <span v-if="getSortKey(group.element) === 'status'" class="sort-indicators">
                                                <font-awesome-icon
                                                    :icon="group.element.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                                    class="arrow-active me-1"
                                                />
                                            </span>
                                        </div>
                                    </button>
                                </li>
                                <li>
                                    <button class="dropdown-item sort-item" type="button" @click="setSort(group.element, 'name')"
                                            :aria-label="$t('Sort by name')"
                                            :title="$t('Sort by name')">
                                        <div class="sort-item-content">
                                            <span>{{ $t("Name") }}</span>
                                            <span v-if="getSortKey(group.element) === 'name'" class="sort-indicators">
                                                <font-awesome-icon
                                                    :icon="group.element.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                                    class="arrow-active me-1"
                                                />
                                            </span>
                                        </div>
                                    </button>
                                </li>
                                <li>
                                    <button class="dropdown-item sort-item" type="button" @click="setSort(group.element, 'uptime')"
                                            :aria-label="$t('Sort by uptime')"
                                            :title="$t('Sort by uptime')">
                                        <div class="sort-item-content">
                                            <span>{{ $t("Uptime") }}</span>
                                            <span v-if="getSortKey(group.element) === 'uptime'" class="sort-indicators">
                                                <font-awesome-icon
                                                    :icon="group.element.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                                    class="arrow-active me-1"
                                                />
                                            </span>
                                        </div>
                                    </button>
                                </li>
                                <li v-if="showCertificateExpiry">
                                    <button class="dropdown-item sort-item" type="button" @click="setSort(group.element, 'cert')"
                                            :aria-label="$t('Sort by certificate expiry')"
                                            :title="$t('Sort by certificate expiry')">
                                        <div class="sort-item-content">
                                            <span>{{ $t("Cert Exp.") }}</span>
                                            <span v-if="getSortKey(group.element) === 'cert'" class="sort-indicators">
                                                <font-awesome-icon
                                                    :icon="group.element.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                                    class="arrow-active me-1"
                                                />
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </h2>

                <div class="shadow-box monitor-list mt-4 position-relative">
                    <div v-if="group.element.monitorList.length === 0" class="text-center no-monitor-msg">
                        {{ $t("No Monitors") }}
                    </div>

                    <!-- Monitor List -->
                    <Draggable
                        v-model="group.element.monitorList"
                        class="monitor-list"
                        group="same-group"
                        :disabled="!editMode"
                        :animation="100"
                        item-key="id"
                    >
                        <template #item="monitor">
                            <div class="item" data-testid="monitor">
                                <div class="row">
                                    <div class="col-6 small-padding">
                                        <div class="info">
                                            <font-awesome-icon v-if="editMode" icon="arrows-alt-v" class="action drag me-3" />
                                            <font-awesome-icon v-if="editMode" icon="times" class="action remove me-3" @click="removeMonitor(group.index, monitor.index)" />

                                            <Uptime :monitor="monitor.element" type="24" :pill="true" />
                                            <a
                                                v-if="showLink(monitor)"
                                                :href="monitor.element.url"
                                                class="item-name"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-testid="monitor-name"
                                            >
                                                {{ monitor.element.name }}
                                            </a>
                                            <p v-else class="item-name" data-testid="monitor-name"> {{ monitor.element.name }} </p>

                                            <span
                                                title="Setting"
                                            >
                                                <font-awesome-icon
                                                    v-if="editMode"
                                                    :class="{'link-active': true, 'btn-link': true}"
                                                    icon="cog" class="action me-3"
                                                    @click="$refs.monitorSettingDialog.show(group, monitor)"
                                                />
                                            </span>
                                        </div>
                                        <div class="extra-info">
                                            <div v-if="showCertificateExpiry && monitor.element.certExpiryDaysRemaining">
                                                <Tag :item="{name: $t('Cert Exp.'), value: formattedCertExpiryMessage(monitor), color: certExpiryColor(monitor)}" :size="'sm'" />
                                            </div>
                                            <div v-if="showTags">
                                                <Tag v-for="tag in monitor.element.tags" :key="tag" :item="tag" :size="'sm'" data-testid="monitor-tag" />
                                            </div>
                                        </div>
                                    </div>
                                    <div :key="$root.userHeartbeatBar" class="col-6">
                                        <HeartbeatBar size="mid" :monitor-id="monitor.element.id" />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Draggable>
                </div>
            </div>
        </template>
    </Draggable>
    <MonitorSettingDialog ref="monitorSettingDialog" />
</template>

<script>
import MonitorSettingDialog from "./MonitorSettingDialog.vue";
import Draggable from "vuedraggable";
import HeartbeatBar from "./HeartbeatBar.vue";
import Uptime from "./Uptime.vue";
import Tag from "./Tag.vue";

export default {
    components: {
        MonitorSettingDialog,
        Draggable,
        HeartbeatBar,
        Uptime,
        Tag,
    },
    props: {
        /** Are we in edit mode? */
        editMode: {
            type: Boolean,
            required: true,
        },
        /** Should tags be shown? */
        showTags: {
            type: Boolean,
        },
        /** Should expiry be shown? */
        showCertificateExpiry: {
            type: Boolean,
        }
    },
    data() {
        return {
        };
    },
    computed: {
        showGroupDrag() {
            return (this.$root.publicGroupList.length >= 2);
        }
    },
    watch: {
        // Watch for changes in heartbeat list, reapply sorting
        "$root.heartbeatList": {
            handler() {
                if (this.$root && this.$root.publicGroupList) {
                    this.$root.publicGroupList.forEach(group => {
                        if (group) {
                            this.applySort(group);
                        }
                    });
                }
            },
            deep: true,
        },

        // Watch for changes in uptime list, reapply sorting
        "$root.uptimeList": {
            handler() {
                if (this.$root && this.$root.publicGroupList) {
                    this.$root.publicGroupList.forEach(group => {
                        if (group) {
                            this.applySort(group);
                        }
                    });
                }
            },
            deep: true,
        },
    },
    created() {
        // Initialize sort settings
        this.initializeSortSettings();
    },
    mounted() {
        // Listen for URL changes
        window.addEventListener("popstate", this.handlePopState);
    },
    beforeUnmount() {
        // Remove URL change listener
        window.removeEventListener("popstate", this.handlePopState);
    },
    methods: {
        /**
         * Initialize group sort settings
         * @returns {void}
         */
        initializeSortSettings() {
            // Load sort settings from URL
            this.handlePopState();

            // Set default sort values for groups not configured in URL
            if (this.$root.publicGroupList) {
                this.$root.publicGroupList.forEach(group => {
                    if (group) {
                        // If sort settings are not defined from URL, use default settings
                        if (group.sortKey === undefined) {
                            group.sortKey = "status";
                        }
                        if (group.sortDirection === undefined) {
                            group.sortDirection = "asc";
                        }

                        // Apply initial sorting
                        this.applySort(group);
                    }
                });
            }

            // Watch for new groups being added and initialize their sort state
            if (this.$root) {
                this.$root.$watch("publicGroupList", (newGroups) => {
                    if (newGroups) {
                        newGroups.forEach(group => {
                            if (group && group.sortKey === undefined) {
                                group.sortKey = "status";
                                group.sortDirection = "asc";
                                this.applySort(group);
                            }
                        });
                    }
                }, { deep: true });
            }
        },

        /**
         * Get sort key for a group
         * @param {object} group object
         * @returns {string} sort key
         */
        getSortKey(group) {
            return group.sortKey || "status";
        },

        /**
         * Set group sort key and direction, then apply sorting
         * @param {object} group object
         * @param {string} key - sort key ('status', 'name', 'uptime', 'cert')
         * @returns {void}
         */
        setSort(group, key) {
            if (group.sortKey === key) {
                group.sortDirection = group.sortDirection === "asc" ? "desc" : "asc";
            } else {
                group.sortKey = key;
                group.sortDirection = "asc";
            }

            this.applySort(group);
            this.updateURLSortParams();
        },

        /**
         * Apply sorting logic directly to the group's monitorList (in-place)
         * @param {object} group object containing monitorList
         * @returns {void}
         */
        applySort(group) {
            if (!group || !group.monitorList || !Array.isArray(group.monitorList)) {
                return;
            }

            const sortKey = group.sortKey || "status";
            const sortDirection = group.sortDirection || "desc";

            group.monitorList.sort((a, b) => {
                if (!a || !b) {
                    return 0;
                }

                let comparison = 0;
                let valueA;
                let valueB;

                if (sortKey === "status") {
                    // Sort by status
                    const getStatusPriority = (monitor) => {
                        if (!monitor || !monitor.id) {
                            return 4;
                        }

                        const hbList = this.$root.heartbeatList || {};
                        const hbArr = hbList[monitor.id];
                        if (hbArr && hbArr.length > 0) {
                            const lastStatus = hbArr.at(-1).status;
                            if (lastStatus === 0) {
                                return 0;
                            } // Down
                            if (lastStatus === 1) {
                                return 1;
                            } // Up
                            if (lastStatus === 2) {
                                return 2;
                            } // Pending
                            if (lastStatus === 3) {
                                return 3;
                            } // Maintenance
                        }
                        return 4; // Unknown/No data
                    };
                    valueA = getStatusPriority(a);
                    valueB = getStatusPriority(b);
                } else if (sortKey === "name") {
                    // Sort alphabetically by name
                    valueA = a.name ? a.name.toLowerCase() : "";
                    valueB = b.name ? b.name.toLowerCase() : "";
                } else if (sortKey === "uptime") {
                    // Sort by uptime
                    const uptimeList = this.$root.uptimeList || {};
                    const uptimeA = a.id ? parseFloat(uptimeList[`${a.id}_24`]) || 0 : 0;
                    const uptimeB = b.id ? parseFloat(uptimeList[`${b.id}_24`]) || 0 : 0;
                    valueA = uptimeA;
                    valueB = uptimeB;
                } else if (sortKey === "cert") {
                    // Sort by certificate expiry time
                    valueA = a.validCert && a.certExpiryDaysRemaining ? a.certExpiryDaysRemaining : -1;
                    valueB = b.validCert && b.certExpiryDaysRemaining ? b.certExpiryDaysRemaining : -1;
                }

                if (valueA < valueB) {
                    comparison = -1;
                } else if (valueA > valueB) {
                    comparison = 1;
                }

                // Special handling for status sorting
                if (sortKey === "status") {
                    return sortDirection === "desc" ? (comparison * -1) : comparison;
                } else {
                    return sortDirection === "asc" ? comparison : (comparison * -1);
                }
            });
        },

        /**
         * Remove the specified group
         * @param {number} index Index of group to remove
         * @returns {void}
         */
        removeGroup(index) {
            this.$root.publicGroupList.splice(index, 1);
        },

        /**
         * Remove a monitor from a group
         * @param {number} groupIndex Index of group to remove monitor from
         * @param {number} index Index of monitor to remove
         * @returns {void}
         */
        removeMonitor(groupIndex, index) {
            this.$root.publicGroupList[groupIndex].monitorList.splice(index, 1);
        },

        /**
         * Should a link to the monitor be shown?
         * Attempts to guess if a link should be shown based upon if
         * sendUrl is set and if the URL is default or not.
         * @param {object} monitor Monitor to check
         * @param {boolean} ignoreSendUrl Should the presence of the sendUrl
         * property be ignored. This will only work in edit mode.
         * @returns {boolean} Should the link be shown
         */
        showLink(monitor, ignoreSendUrl = false) {
            // We must check if there are any elements in monitorList to
            // prevent undefined errors if it hasn't been loaded yet
            if (this.$parent.editMode && ignoreSendUrl && Object.keys(this.$root.monitorList).length) {
                return this.$root.monitorList[monitor.element.id].type === "http" ||
                    this.$root.monitorList[monitor.element.id].type === "keyword" ||
                    this.$root.monitorList[monitor.element.id].type === "json-query";
            }
            return monitor.element.sendUrl && monitor.element.url && monitor.element.url !== "https://";
        },

        /**
         * Returns formatted certificate expiry or Bad cert message
         * @param {object} monitor Monitor to show expiry for
         * @returns {string} Certificate expiry message
         */
        formattedCertExpiryMessage(monitor) {
            if (monitor?.element?.validCert && monitor?.element?.certExpiryDaysRemaining) {
                return monitor.element.certExpiryDaysRemaining + " " + this.$tc("day", monitor.element.certExpiryDaysRemaining);
            } else if (monitor?.element?.validCert === false) {
                return this.$t("noOrBadCertificate");
            } else {
                return this.$t("Unknown") + " " + this.$tc("day", 2);
            }
        },

        /**
         * Returns certificate expiry color based on days remaining
         * @param {object} monitor Monitor to show expiry for
         * @returns {string} Color for certificate expiry
         */
        certExpiryColor(monitor) {
            if (monitor?.element?.validCert && monitor.element.certExpiryDaysRemaining > 7) {
                return "#059669";
            }
            return "#DC2626";
        },

        /**
         * Handle browser back/forward button events
         * @returns {void}
         */
        handlePopState() {
            if (!this.$root.publicGroupList) {
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);

            // Iterate through all groups, look for sort parameters in URL
            this.$root.publicGroupList.forEach(group => {
                if (!group) {
                    return;
                }

                const groupId = this.getGroupIdentifier(group);
                const sortParam = urlParams.get(`sort_${groupId}`);

                if (sortParam) {
                    const [ key, direction ] = sortParam.split("_");
                    if (key && [ "status", "name", "uptime", "cert" ].includes(key) &&
                        direction && [ "asc", "desc" ].includes(direction)) {
                        group.sortKey = key;
                        group.sortDirection = direction;
                        this.applySort(group);
                    }
                }
            });
        },

        /**
         * Update sort parameters in URL
         * @returns {void}
         */
        updateURLSortParams() {
            if (!this.$root.publicGroupList) {
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);

            // First clear all sort_ parameters
            const paramsToRemove = [];
            for (const [ key ] of urlParams.entries()) {
                if (key.startsWith("sort_")) {
                    paramsToRemove.push(key);
                }
            }

            paramsToRemove.forEach(key => {
                urlParams.delete(key);
            });

            // Add current sort parameters
            this.$root.publicGroupList.forEach(group => {
                if (!group || !group.sortKey) {
                    return;
                }

                const groupId = this.getGroupIdentifier(group);
                urlParams.set(`sort_${groupId}`, `${group.sortKey}_${group.sortDirection}`);
            });

            // Update URL without refreshing the page
            const newUrl = `${window.location.pathname}${urlParams.toString() ? "?" + urlParams.toString() : ""}`;
            window.history.pushState({ path: newUrl }, "", newUrl);
        },

        /**
         * Get unique identifier for a group
         * @param {object} group object
         * @returns {string} group identifier
         */
        getGroupIdentifier(group) {
            // Use the name directly if available
            if (group.name) {
                // Only remove spaces and use encodeURIComponent for URL safety
                const cleanName = group.name.replace(/\s+/g, "");
                return cleanName;
            }
            // Fallback to ID or index
            return group.id ? `group${group.id}` : `group${this.$root.publicGroupList.indexOf(group)}`;
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.extra-info {
    display: flex;
    margin-bottom: 0.5rem;
}

.extra-info > div > div:first-child {
    margin-left: 0 !important;
}

.no-monitor-msg {
    position: absolute;
    width: 100%;
    top: 20px;
    left: 0;
}

.monitor-list {
    min-height: 46px;
}

.item-name {
    padding-left: 5px;
    padding-right: 5px;
    margin: 0;
    display: inline-block;
}

.btn-link {
    color: #bbbbbb;
    margin-left: 5px;
}

.link-active {
    color: $primary;
}

.flip-list-move {
    transition: transform 0.5s;
}

.no-move {
    transition: transform 0s;
}

.drag {
    color: #bbb;
    cursor: grab;
}

.remove {
    color: $danger;
}

.group-title {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title-section {
        display: flex;
        align-items: center;
    }

    span {
        display: inline-block;
        min-width: 15px;
    }
}

.sort-dropdown {
    margin-left: auto;
}

.sort-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.3rem 0.6rem;
    min-width: 40px;
    border-radius: 10px;
    background-color: white;
    border: none;
    box-shadow: 0 15px 70px rgba(0, 0, 0, 0.1);
    transition: all ease-in-out 0.15s;

    &:hover {
        background-color: #f8f9fa;
    }

    &:focus, &:active {
        box-shadow: 0 15px 70px rgba(0, 0, 0, 0.1);
        border: none;
        outline: none;
    }

    .dark & {
        background-color: $dark-bg;
        color: $dark-font-color;
        box-shadow: 0 15px 70px rgba(0, 0, 0, 0.3);

        &:hover {
            background-color: $dark-bg2;
        }

        &:focus, &:active {
            box-shadow: 0 15px 70px rgba(0, 0, 0, 0.3);
        }
    }
}

.sort-arrows {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 2px;
}

.arrow-inactive {
    color: #aaa;
    font-size: 0.7rem;
    opacity: 0.5;

    .dark & {
        color: #6c757d;
    }
}

.arrow-active {
    color: #4caf50;
    font-size: 0.8rem;

    .dark & {
        color: $primary;
    }
}

.sort-menu {
    min-width: auto;
    width: auto;
    padding: 0.2rem 0;
    border-radius: 10px;
    border: none;
    box-shadow: 0 15px 70px rgba(0, 0, 0, 0.1);
    overflow: hidden;

    .dark & {
        background-color: $dark-bg;
        color: $dark-font-color;
        border-color: $dark-border-color;
        box-shadow: 0 15px 70px rgba(0, 0, 0, 0.3);
    }
}

.sort-item {
    padding: 0.4rem 0.8rem;
    text-align: left;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;

    &:hover {
        background-color: #f8f9fa;
    }

    .dark & {
        color: $dark-font-color;

        &:hover {
            background-color: $dark-bg2;
        }
    }
}

.sort-item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-width: 120px;
}

.sort-indicators {
    display: flex;
    align-items: center;
    margin-left: 10px;
}

.sort-direction-indicator {
    font-weight: bold;
    display: inline-block;
    margin-left: 2px;
}

.mobile {
    .item {
        padding: 13px 0 10px;
    }

    .group-title {
        flex-direction: column;
        align-items: flex-start;

        .sort-dropdown {
            margin-left: 0;
            margin-top: 0.5rem;
            width: 100%;
        }
    }
}

.bg-maintenance {
    background-color: $maintenance;
}
</style>
