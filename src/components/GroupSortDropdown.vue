<template>
    <div v-if="group && group.monitorList && group.monitorList.length > 1" class="sort-dropdown">
        <div class="dropdown">
            <button
                :id="'sortDropdown' + groupIndex"
                type="button"
                class="btn btn-sm btn-outline-secondary dropdown-toggle sort-button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                :aria-label="$t('Sort options')"
                :title="$t('Sort options')"
            >
                <div class="sort-arrows">
                    <font-awesome-icon
                        icon="arrow-down"
                        :class="{
                            'arrow-inactive': !group.sortKey || group.sortDirection !== 'desc',
                            'arrow-active': group.sortKey && group.sortDirection === 'desc',
                        }"
                    />
                    <font-awesome-icon
                        icon="arrow-up"
                        :class="{
                            'arrow-inactive': !group.sortKey || group.sortDirection !== 'asc',
                            'arrow-active': group.sortKey && group.sortDirection === 'asc',
                        }"
                    />
                </div>
            </button>
            <ul class="dropdown-menu dropdown-menu-end sort-menu" :aria-labelledby="'sortDropdown' + groupIndex">
                <li>
                    <button
                        class="dropdown-item sort-item"
                        type="button"
                        :aria-label="$t('Sort by status')"
                        :title="$t('Sort by status')"
                        @click="setSort('status')"
                    >
                        <div class="sort-item-content">
                            <span>{{ $t("Status") }}</span>
                            <span v-if="getSortKey() === 'status'" class="sort-indicators">
                                <font-awesome-icon
                                    :icon="group.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                    class="arrow-active me-1"
                                />
                            </span>
                        </div>
                    </button>
                </li>
                <li>
                    <button
                        class="dropdown-item sort-item"
                        type="button"
                        :aria-label="$t('Sort by name')"
                        :title="$t('Sort by name')"
                        @click="setSort('name')"
                    >
                        <div class="sort-item-content">
                            <span>{{ $t("Name") }}</span>
                            <span v-if="getSortKey() === 'name'" class="sort-indicators">
                                <font-awesome-icon
                                    :icon="group.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                    class="arrow-active me-1"
                                />
                            </span>
                        </div>
                    </button>
                </li>
                <li>
                    <button
                        class="dropdown-item sort-item"
                        type="button"
                        :aria-label="$t('Sort by uptime')"
                        :title="$t('Sort by uptime')"
                        @click="setSort('uptime')"
                    >
                        <div class="sort-item-content">
                            <span>{{ $t("Uptime") }}</span>
                            <span v-if="getSortKey() === 'uptime'" class="sort-indicators">
                                <font-awesome-icon
                                    :icon="group.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                    class="arrow-active me-1"
                                />
                            </span>
                        </div>
                    </button>
                </li>
                <li v-if="showCertificateExpiry">
                    <button
                        class="dropdown-item sort-item"
                        type="button"
                        :aria-label="$t('Sort by certificate expiry')"
                        :title="$t('Sort by certificate expiry')"
                        @click="setSort('cert')"
                    >
                        <div class="sort-item-content">
                            <span>{{ $t("Cert Exp.") }}</span>
                            <span v-if="getSortKey() === 'cert'" class="sort-indicators">
                                <font-awesome-icon
                                    :icon="group.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'"
                                    class="arrow-active me-1"
                                />
                            </span>
                        </div>
                    </button>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import { DOWN, MAINTENANCE, PENDING, UP } from "../util.ts";

const UNKNOWN_STATUS_PRIORITY = 4;

export default {
    name: "GroupSortDropdown",
    props: {
        /** Group object containing monitorList and sort settings */
        group: {
            type: Object,
            required: true,
        },
        /** Index of the group for unique IDs */
        groupIndex: {
            type: Number,
            required: true,
        },
        /** Should certificate expiry options be shown? */
        showCertificateExpiry: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["update-group"],
    computed: {
        /**
         * Parse sort settings from URL query parameters
         * @returns {object} Parsed sort settings for all groups
         */
        sortSettingsFromURL() {
            const sortSettings = {};
            if (this.$route && this.$route.query) {
                for (const [key, value] of Object.entries(this.$route.query)) {
                    if (key.startsWith("sort_") && typeof value === "string") {
                        const groupId = key.replace("sort_", "");
                        const [sortKey, direction] = value.split("_");
                        if (
                            sortKey &&
                            ["status", "name", "uptime", "cert"].includes(sortKey) &&
                            direction &&
                            ["asc", "desc"].includes(direction)
                        ) {
                            sortSettings[groupId] = {
                                sortKey,
                                direction,
                            };
                        }
                    }
                }
            }
            return sortSettings;
        },

        /**
         * Values that can affect monitor ordering.
         * @returns {Array}
         */
        sortDependencies() {
            if (!this.group || !Array.isArray(this.group.monitorList)) {
                return [];
            }

            const sortKey = this.group.sortKey || "status";
            const sortDirection = this.group.sortDirection || "desc";

            return [
                sortKey,
                sortDirection,
                ...this.group.monitorList.map((monitor) => {
                    if (!monitor || !monitor.id) {
                        return null;
                    }

                    if (sortKey === "cert") {
                        return [monitor.id, monitor.validCert ?? null, monitor.certExpiryDaysRemaining ?? null];
                    }

                    return [monitor.id, this.getSortValue(monitor, sortKey)];
                }),
            ];
        },
    },
    watch: {
        sortDependencies: {
            handler() {
                this.applySort();
            },
            immediate: true,
        },

        // Watch for URL changes and apply sort settings
        sortSettingsFromURL: {
            handler(newSortSettings) {
                if (this.group) {
                    const groupId = this.getGroupIdentifier();
                    const urlSetting = newSortSettings[groupId];

                    if (urlSetting) {
                        this.updateGroup({
                            sortKey: urlSetting.sortKey,
                            sortDirection: urlSetting.direction,
                        });
                    } else {
                        // Set defaults if not in URL
                        if (this.group.sortKey === undefined) {
                            this.updateGroup({ sortKey: "status" });
                        }
                        if (this.group.sortDirection === undefined) {
                            this.updateGroup({ sortDirection: "asc" });
                        }
                    }

                    this.applySort();
                }
            },
            immediate: true,
            deep: true,
        },
    },
    methods: {
        /**
         * Get sort key for the group
         * @returns {string} sort key
         */
        getSortKey() {
            return this.group.sortKey || "status";
        },

        /**
         * Update group properties by emitting to parent
         * @param {object} updates - object with properties to update
         * @returns {void}
         */
        updateGroup(updates) {
            this.$emit("update-group", this.groupIndex, updates);
        },

        /**
         * Set group sort key and direction, then apply sorting
         * @param {string} key - sort key ('status', 'name', 'uptime', 'cert')
         * @returns {void}
         */
        setSort(key) {
            if (this.group.sortKey === key) {
                this.updateGroup({
                    sortDirection: this.group.sortDirection === "asc" ? "desc" : "asc",
                });
            } else {
                this.updateGroup({
                    sortKey: key,
                    sortDirection: "asc",
                });
            }

            this.applySort();
            this.updateRouterQuery();
        },

        /**
         * Update router query parameters with sort settings
         * @returns {void}
         */
        updateRouterQuery() {
            if (!this.$router) {
                return;
            }

            const query = { ...this.$route.query };
            const groupId = this.getGroupIdentifier();

            if (this.group.sortKey && this.group.sortDirection) {
                query[`sort_${groupId}`] = `${this.group.sortKey}_${this.group.sortDirection}`;
            } else {
                delete query[`sort_${groupId}`];
            }

            this.$router.push({ query }).catch(() => {});
        },

        /**
         * Check whether sorting produced a different monitor order.
         * @param {object[]} sortedMonitorList
         * @returns {boolean}
         */
        hasMonitorOrderChanged(sortedMonitorList) {
            if (sortedMonitorList.length !== this.group.monitorList.length) {
                return true;
            }

            let hasOrderChanged = false;

            for (const [index, monitor] of sortedMonitorList.entries()) {
                if (monitor?.id !== this.group.monitorList[index]?.id) {
                    hasOrderChanged = true;
                    break;
                }
            }

            return hasOrderChanged;
        },

        /**
         * Get the sortable value for a monitor.
         * @param {object} monitor
         * @param {string} sortKey
         * @returns {number|string}
         */
        getSortValue(monitor, sortKey) {
            switch (sortKey) {
                case "status": {
                    if (!monitor || !monitor.id) {
                        return UNKNOWN_STATUS_PRIORITY;
                    }

                    const hbList = this.$root.heartbeatList || {};
                    const hbArr = hbList[monitor.id];

                    if (hbArr && hbArr.length > 0) {
                        const lastStatus = hbArr.at(-1).status;

                        if ([DOWN, UP, PENDING, MAINTENANCE].includes(lastStatus)) {
                            return lastStatus;
                        }
                    }

                    return UNKNOWN_STATUS_PRIORITY;
                }
                case "name":
                    return monitor?.name ?? "";
                case "uptime": {
                    const uptimeList = this.$root.uptimeList || {};
                    return monitor?.id ? parseFloat(uptimeList[`${monitor.id}_24`]) || 0 : 0;
                }
                case "cert":
                    return monitor?.validCert && monitor?.certExpiryDaysRemaining
                        ? monitor.certExpiryDaysRemaining
                        : -1;
                default:
                    return 0;
            }
        },

        /**
         * Apply sorting logic directly to the group's monitorList (in-place)
         * @returns {void}
         */
        applySort() {
            if (!this.group || !this.group.monitorList || !Array.isArray(this.group.monitorList)) {
                return;
            }

            const sortKey = this.group.sortKey || "status";
            const sortDirection = this.group.sortDirection || "desc";
            const sortMultiplier =
                sortKey === "status" ? (sortDirection === "desc" ? -1 : 1) : sortDirection === "asc" ? 1 : -1;
            const sortedMonitorList = [...this.group.monitorList].sort((a, b) => {
                if (!a || !b) {
                    return 0;
                }

                const valueA = this.getSortValue(a, sortKey);
                const valueB = this.getSortValue(b, sortKey);
                let comparison = 0;

                if (sortKey === "name") {
                    comparison = valueA.localeCompare(valueB, undefined, {
                        sensitivity: "base",
                        numeric: true,
                    });
                } else if (valueA < valueB) {
                    comparison = -1;
                } else if (valueA > valueB) {
                    comparison = 1;
                }

                return comparison * sortMultiplier;
            });

            if (!this.hasMonitorOrderChanged(sortedMonitorList)) {
                return;
            }

            this.updateGroup({
                monitorList: sortedMonitorList,
            });
        },

        /**
         * Get unique identifier for the group
         * @returns {string} group identifier
         */
        getGroupIdentifier() {
            // Prefer a stable server-provided id to avoid clashes between groups with the same name
            if (this.group.id !== undefined && this.group.id !== null) {
                return this.group.id.toString();
            }

            // Fallback to the current index for unsaved groups
            return `group${this.groupIndex}`;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

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

    &:focus,
    &:active {
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

        &:focus,
        &:active {
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
</style>
