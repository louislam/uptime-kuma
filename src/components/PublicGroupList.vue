<template>
    <!-- Group List -->
    <div v-if="hasPublicGroups && !editMode" class="global-controls-container">
        <!-- Global Controls Title -->
        <h5 class="global-controls-title">{{ $t("Global Sorting Options") }}</h5>
        
        <!-- Global Sorting Bar and Search Box -->
        <div class="global-controls-content">
            <!-- Global Sort Buttons Group -->
            <div class="global-sort-controls">
                <span class="sort-label me-2">{{ $t("Sort By") }}:</span>
                <div class="sort-buttons">
                    <button
                        class="btn btn-sm sort-button"
                        :class="{'active': globalSortKey === 'status' && isGlobalSortActive && !hasAnyGroupWithIndependentSort}"
                        @click="setGlobalSort('status')"
                    >
                        {{ $t("Status") }}
                        <font-awesome-icon v-if="globalSortKey === 'status' && isGlobalSortActive" :icon="globalSortDirection === 'asc' ? 'arrow-up' : 'arrow-down'" />
                    </button>
                    <button
                        class="btn btn-sm sort-button"
                        :class="{'active': globalSortKey === 'name' && isGlobalSortActive && !hasAnyGroupWithIndependentSort}"
                        @click="setGlobalSort('name')"
                    >
                        {{ $t("Name") }}
                        <font-awesome-icon v-if="globalSortKey === 'name' && isGlobalSortActive" :icon="globalSortDirection === 'asc' ? 'arrow-up' : 'arrow-down'" />
                    </button>
                    <button
                        class="btn btn-sm sort-button"
                        :class="{'active': globalSortKey === 'uptime' && isGlobalSortActive && !hasAnyGroupWithIndependentSort}"
                        @click="setGlobalSort('uptime')"
                    >
                        {{ $t("Uptime") }}
                        <font-awesome-icon v-if="globalSortKey === 'uptime' && isGlobalSortActive" :icon="globalSortDirection === 'asc' ? 'arrow-up' : 'arrow-down'" />
                    </button>
                    <button
                        v-if="showCertificateExpiry"
                        class="btn btn-sm sort-button"
                        :class="{'active': globalSortKey === 'cert' && isGlobalSortActive && !hasAnyGroupWithIndependentSort}"
                        @click="setGlobalSort('cert')"
                    >
                        {{ $t("Cert Exp.") }}
                        <font-awesome-icon v-if="globalSortKey === 'cert' && isGlobalSortActive" :icon="globalSortDirection === 'asc' ? 'arrow-up' : 'arrow-down'" />
                    </button>
                </div>
            </div>
            
            <!-- Global Search Box -->
            <div class="global-search-container">
                <div class="input-group">
                    <input 
                        type="text" 
                        class="form-control form-control-sm" 
                        v-model="globalSearchKeyword" 
                        :placeholder="$t('Search monitors across all groups')" 
                        aria-label="Global search"
                    >
                    <button 
                        v-if="globalSearchKeyword" 
                        class="btn btn-outline-secondary btn-sm" 
                        type="button" 
                        @click="clearGlobalSearch"
                        title="Clear search"
                    >
                        <font-awesome-icon icon="times" />
                    </button>
                </div>
                <small v-if="globalSearchResultCount !== null" class="text-muted">
                    {{ $t("Found {0} monitors", [globalSearchResultCount]) }}
                </small>
            </div>
        </div>
    </div>

    <Draggable
        v-if="$root && $root.publicGroupList"
        v-model="$root.publicGroupList"
        :disabled="!editMode"
        item-key="id"
        :animation="100"
    >
        <template #item="group">
            <div v-if="group && group.element" class="mb-5 group-container" data-testid="group" v-show="shouldShowGroup(group.element)">
                <!-- Group Container -->
                <div class="shadow-box">
                    <!-- Group Title and Search Bar -->
                    <div class="group-header">
                <h2 class="group-title">
                    <font-awesome-icon v-if="editMode && showGroupDrag" icon="arrows-alt-v" class="action drag me-3" />
                    <font-awesome-icon v-if="editMode" icon="times" class="action remove me-3" @click="removeGroup(group.index)" />
                    <Editable v-model="group.element.name" :contenteditable="editMode" tag="span" data-testid="group-name" />
                </h2>

                        <!-- Group Search Box -->
                        <div v-if="!editMode && group.element && group.element.monitorList && group.element.monitorList.length > 0" 
                            class="search-container">
                            <div class="search-input-wrapper">
                                <input 
                                    type="text" 
                                    v-model="group.element.searchKeyword" 
                                    :placeholder="$t('Search...')" 
                                    class="search-input form-control form-control-sm"
                                    @keyup.esc="clearSearch(group.element)"
                                >
                                <button 
                                    class="search-button btn btn-sm"
                                    @click="clearSearch(group.element)"
                                    v-if="group.element && group.element.searchKeyword"
                                    title="Clear search"
                                >
                                    <font-awesome-icon icon="times" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Group Sort Button Bar -->
                    <div v-if="!editMode && group.element && group.element.monitorList && group.element.monitorList.length > 0" 
                        class="sort-bar">
                        <div class="sort-controls">
                            <span class="sort-label me-2">
                                {{ $t("Sort By") }}:
                            </span>
                            <div class="sort-buttons">
                                <button
                                    class="sort-button"
                                    :class="{
                                        'active': (isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'status') || 
                                                ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'status')
                                    }"
                                    @click="setSort(group.element, 'status')"
                                >
                                    {{ $t("Status") }}
                                    <font-awesome-icon 
                                        v-if="(isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'status') || 
                                            ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'status')" 
                                        :icon="(isGlobalSortActive && !group.element.useOwnSort ? globalSortDirection : group.element.sortDirection) === 'asc' ? 'arrow-up' : 'arrow-down'" 
                                    />
                                </button>
                                <button
                                    class="sort-button"
                                    :class="{
                                        'active': (isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'name') || 
                                                ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'name')
                                    }"
                                    @click="setSort(group.element, 'name')"
                                >
                                    {{ $t("Name") }}
                                    <font-awesome-icon 
                                        v-if="(isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'name') || 
                                            ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'name')" 
                                        :icon="(isGlobalSortActive && !group.element.useOwnSort ? globalSortDirection : group.element.sortDirection) === 'asc' ? 'arrow-up' : 'arrow-down'" 
                                    />
                                </button>
                                <button
                                    class="sort-button"
                                    :class="{
                                        'active': (isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'uptime') || 
                                                ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'uptime')
                                    }"
                                    @click="setSort(group.element, 'uptime')"
                                >
                                    {{ $t("Uptime") }}
                                    <font-awesome-icon 
                                        v-if="(isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'uptime') || 
                                            ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'uptime')" 
                                        :icon="(isGlobalSortActive && !group.element.useOwnSort ? globalSortDirection : group.element.sortDirection) === 'asc' ? 'arrow-up' : 'arrow-down'" 
                                    />
                                </button>
                                <button
                                    v-if="showCertificateExpiry"
                                    class="sort-button"
                                    :class="{
                                        'active': (isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'cert') || 
                                                ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'cert')
                                    }"
                                    @click="setSort(group.element, 'cert')"
                                >
                                    {{ $t("Cert Exp.") }}
                                    <font-awesome-icon 
                                        v-if="(isGlobalSortActive && !group.element.useOwnSort && globalSortKey === 'cert') || 
                                            ((isGlobalSortActive && group.element.useOwnSort || !isGlobalSortActive) && group.element.sortKey === 'cert')" 
                                        :icon="(isGlobalSortActive && !group.element.useOwnSort ? globalSortDirection : group.element.sortDirection) === 'asc' ? 'arrow-up' : 'arrow-down'" 
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Monitor List -->
                    <div class="monitor-list-container">
                        <div v-if="!group.element || !group.element.monitorList || group.element.monitorList.length === 0" class="text-center no-monitor-msg">
                        {{ $t("No Monitors") }}
                        </div>
                        <div v-else-if="getFilteredMonitorList(group.element).length === 0" class="text-center no-monitor-msg">
                            {{ $t("No services found") }}
                    </div>

                    <!-- Monitor List -->
                    <Draggable
                            v-if="group.element && group.element.monitorList && group.element.monitorList.length > 0"
                        v-model="group.element.monitorList"
                        class="monitor-list"
                        group="same-group"
                        :disabled="!editMode"
                        :animation="100"
                        item-key="id"
                    >
                            <template #item="{ element: monitor, index: monitorIndex }">
                                <div v-if="shouldShowMonitor(monitor, group.element)" class="item" data-testid="monitor">
                                <div class="row">
                                    <div class="col-9 col-md-8 small-padding">
                                        <div class="info">
                                            <font-awesome-icon v-if="editMode" icon="arrows-alt-v" class="action drag me-3" />
                                                <font-awesome-icon v-if="editMode" icon="times" class="action remove me-3" @click="removeMonitor(group.index, monitorIndex)" />

                                                <Uptime :monitor="monitor" type="24" :pill="true" />
                                            <a
                                                v-if="showLink(monitor)"
                                                    :href="monitor.url"
                                                class="item-name"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-testid="monitor-name"
                                            >
                                                    {{ monitor.name }}
                                            </a>
                                                <p v-else class="item-name" data-testid="monitor-name"> {{ monitor.name }} </p>

                                            <span
                                                title="Setting"
                                            >
                                                <font-awesome-icon
                                                    v-if="editMode"
                                                    :class="{'link-active': true, 'btn-link': true}"
                                                    icon="cog" class="action me-3"
                                                        @click="$refs.monitorSettingDialog.show(group.element, monitor)"
                                                />
                                            </span>
                                        </div>
                                        <div class="extra-info">
                                                <div v-if="showCertificateExpiry && monitor.certExpiryDaysRemaining">
                                                <Tag :item="{name: $t('Cert Exp.'), value: formattedCertExpiryMessage(monitor), color: certExpiryColor(monitor)}" :size="'sm'" />
                                            </div>
                                            <div v-if="showTags">
                                                    <Tag v-for="tag in monitor.tags" :key="tag" :item="tag" :size="'sm'" data-testid="monitor-tag" />
                                                </div>
                                        </div>
                                    </div>
                                    <div :key="$root.userHeartbeatBar" class="col-3 col-md-4">
                                            <HeartbeatBar size="mid" :monitor-id="monitor.id" />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Draggable>
                    </div>
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
        },
        /** Status page slug */
        slug: {
            type: String,
            default: 'default'
        },
        monitorList: {
            type: Array,
            default: () => [],
        },
        groups: {
            type: Array,
            default: () => [],
        },
    },
    data() {
        return {
            globalSearchKeyword: '',
            searchText: "",
            globalSortKey: 'status',
            globalSortDirection: 'desc',
            isGlobalSortActive: false,
        };
    },
    computed: {
        showGroupDrag() {
            return (this.$root && this.$root.publicGroupList && this.$root.publicGroupList.length >= 2);
        },
        hasMonitors() {
            return this.groups && Array.isArray(this.groups) && this.groups.some(group => 
                group && group.element && group.element.monitorList && group.element.monitorList.length > 0
            );
        },
        hasPublicGroups() {
            return this.$root && 
                   this.$root.publicGroupList && 
                   Array.isArray(this.$root.publicGroupList) && 
                   this.$root.publicGroupList.length > 0 &&
                   this.$root.publicGroupList.some(group => 
                       group && group.monitorList && group.monitorList.length > 0
                   );
        },
        filteredMonitorList() {
            if (!this.searchText || !this.monitorList) {
                return this.monitorList || [];
            }
            
            const searchLower = this.searchText.toLowerCase();
            return this.monitorList.filter(monitor => 
                monitor && monitor.name && monitor.name.toLowerCase().includes(searchLower)
            );
        },
        shouldShowSearch() {
            return !this.editMode && this.monitorList && this.monitorList.length > 0;
        },
        globalSearchResultCount() {
            if (!this.globalSearchKeyword) {
                return null;
            }
            
            let count = 0;
            if (!this.groups) return count;
            
            for (const group of this.groups) {
                if (!group || !group.element || !group.element.monitorList) continue;
                
                for (const monitor of group.element.monitorList) {
                    if (monitor && this.matchesGlobalSearch(monitor)) {
                        count++;
                    }
                }
            }
            return count;
        },
        hasAnyGroupWithIndependentSort() {
            if (!this.$root || !this.$root.publicGroupList) {
                return false;
            }
            
            return this.$root.publicGroupList.some(group => 
                group && group.useOwnSort === true
            );
        },
    },
    watch: {
        // Watch for changes in heartbeatList to re-apply sort
        '$root.heartbeatList': {
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
        // Watch for changes in uptimeList to re-apply sort
        '$root.uptimeList': {
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
        // Watch for changes in global sort
        globalSortKey: {
            handler() {
                this.applyGlobalSort();
            }
        },
        globalSortDirection: {
            handler() {
                this.applyGlobalSort();
            }
        }
    },
    created() {
        // Method to get saved sort settings from localStorage
        const getSavedSortSettings = (group) => {
            try {
                const groupId = group.id || group.name || 'Default Group';
                const storageKey = `uptime-kuma-sort-${this.slug}-${groupId}`;
                
                const savedSettings = localStorage.getItem(storageKey);
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    return {
                        key: settings.key,
                        direction: settings.direction
                    };
                }
            } catch (error) {
                console.error('Cannot read sort settings', error);
            }
            return null;
        };

        // Try to read saved global sort settings from localStorage
        try {
            const storageKey = `uptime-kuma-global-sort-${this.slug}`;
            const savedGlobalSettings = localStorage.getItem(storageKey);
            if (savedGlobalSettings) {
                const settings = JSON.parse(savedGlobalSettings);
                this.globalSortKey = settings.key;
                this.globalSortDirection = settings.direction;
                // Also restore global sort active state
                this.isGlobalSortActive = settings.active === undefined ? false : settings.active;
            }
        } catch (error) {
            console.error('Cannot read global sort settings', error);
        }

        // Initialize sort state and apply initial sort for existing groups
        if (this.$root.publicGroupList) {
            this.$root.publicGroupList.forEach(group => {
                if (group) {
                    // Initialize search keywords
                    if (group.searchKeyword === undefined) {
                        group.searchKeyword = '';
                    }
                    
                    // Try to read saved sort settings from localStorage
                    const savedSettings = getSavedSortSettings(group);
                    
                    if (savedSettings) {
                        // Apply saved settings if found
                        group.sortKey = savedSettings.key;
                        group.sortDirection = savedSettings.direction;
                    } else {
                        // Use default settings otherwise
                        if (group.sortKey === undefined) {
                            group.sortKey = 'status';
                        }
                        if (group.sortDirection === undefined) {
                            group.sortDirection = 'desc';
                        }
                    }
                    
                    // Apply initial sort when the component is created
                    this.applySort(group);
                }
            });
        }

        // Apply global sorting after initialization
        this.applyGlobalSort();

        // Watch for new groups being added and initialize their sort state
        if (this.$root) {
            this.$root.$watch('publicGroupList', (newGroups) => {
                if (newGroups) {
                    newGroups.forEach(group => {
                        if (group) {
                            // Ensure each group has search keyword property
                            if (group.searchKeyword === undefined) {
                                group.searchKeyword = '';
                            }
                            
                            if (group.sortKey === undefined) {
                                // Try to read sort settings from localStorage
                                const savedSettings = getSavedSortSettings(group);
                                
                                if (savedSettings) {
                                    // Apply saved settings if found
                                    group.sortKey = savedSettings.key;
                                    group.sortDirection = savedSettings.direction;
                                } else {
                                    // Use default settings otherwise
                                    group.sortKey = 'status';
                                    group.sortDirection = 'desc';
                                }
                                
                                // Apply sort to newly added group
                                this.applySort(group);
                            }
                        }
                    });
                }
            }, { deep: true });
        }
    },
    unmounted() {
        // Clean up references when component is unmounted to avoid memory leaks
        // In Vue 3, watchers are automatically cleaned up when component is unmounted
    },
    methods: {
        /**
         * Check if monitor matches search keyword
         * @param {object} monitor Monitor object
         * @param {string} keyword Search keyword
         * @returns {boolean} Whether it matches
         */
        monitorMatchesSearch(monitor, keyword) {
            if (!keyword) return true;
            if (!monitor) return false;
            
            keyword = keyword.toLowerCase().trim();
            
            // Search name, URL and description fields
            return (monitor.name && monitor.name.toLowerCase().includes(keyword)) || 
                   (monitor.url && monitor.url.toLowerCase().includes(keyword)) || 
                   (monitor.description && monitor.description.toLowerCase().includes(keyword));
        },
        
        /**
         * Check if monitor matches global search criteria
         * @param {object} monitor Monitor object
         * @returns {boolean} Whether it matches
         */
        matchesGlobalSearch(monitor) {
            if (!this.globalSearchKeyword) return true;
            if (!monitor) return false;
            
            return this.monitorMatchesSearch(monitor, this.globalSearchKeyword);
        },
        
        /**
         * Determine if monitor should be displayed
         * @param {object} monitor Monitor object
         * @param {object} group Group object
         * @returns {boolean} Whether to display
         */
        shouldShowMonitor(monitor, group) {
            if (!monitor) return false;
            
            // Check global search first
            if (this.globalSearchKeyword && !this.matchesGlobalSearch(monitor)) {
                return false;
            }
            
            // Then check group search
            if (group && group.searchKeyword) {
                return this.monitorMatchesSearch(monitor, group.searchKeyword);
            }
            
            return true;
        },
        
        /**
         * Get filtered monitor list
         * @param {object} group Group object
         * @returns {array} Filtered monitor list
         */
        getFilteredMonitorList(group) {
            if (!group || !group.monitorList || !Array.isArray(group.monitorList)) return [];
            
            let result = [...group.monitorList]; // Create a copy to avoid modifying original array
            
            // Apply global search first
            if (this.globalSearchKeyword) {
                result = result.filter(monitor => 
                    monitor && this.matchesGlobalSearch(monitor)
                );
            }
            
            // Then apply group search
            if (group.searchKeyword) {
                result = result.filter(monitor => 
                    monitor && this.monitorMatchesSearch(monitor, group.searchKeyword)
                );
            }
            
            return result;
        },
        
        /**
         * Determine if group should be displayed
         * @param {object} group Group object
         * @returns {boolean} Whether to display
         */
        shouldShowGroup(group) {
            if (!group) return false;
            
            // Always show in edit mode
            if (this.editMode) return true;
            
            // If there's global search, only show groups containing matching monitors
            if (this.globalSearchKeyword) {
                return group.monitorList && group.monitorList.some(monitor => 
                    this.matchesGlobalSearch(monitor)
                );
            }
            
            return true;
        },
        
        /**
         * Clear group search keyword
         * @param {object} group Group object
         */
        clearSearch(group) {
            if (group) {
                group.searchKeyword = '';
            }
        },
        
        /**
         * Clear global search keyword
         */
        clearGlobalSearch() {
            this.globalSearchKeyword = '';
        },
        
        /**
         * Set sort key and direction for a group, then apply the sort
         * @param {object} group The group object
         * @param {string} key The sort key ('status', 'name', 'uptime', 'cert')
         */
        setSort(group, key) {
            // Change only the current group's sort settings even when global sort is active
            if (group.sortKey === key) {
                group.sortDirection = group.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                group.sortKey = key;
                group.sortDirection = (key === 'status') ? 'desc' : 'asc';
            }
            
            // Save sort settings to localStorage
            try {
                // Get a unique identifier for the group, use name if id is not available
                const groupId = group.id || group.name || 'Default Group';
                const storageKey = `uptime-kuma-sort-${this.slug}-${groupId}`;
                
                // Save sort settings
                const sortSettings = {
                    key: group.sortKey,
                    direction: group.sortDirection
                };
                localStorage.setItem(storageKey, JSON.stringify(sortSettings));
            } catch (error) {
                console.error('Cannot save sort settings', error);
            }
            
            // If global sort is active, we need to temporarily disable it to apply group's sort
            const wasGlobalSortActive = this.isGlobalSortActive;
            
            // Temporarily disable global sort
            if (wasGlobalSortActive) {
                // Set independent sort flag for current group
                group.useOwnSort = true;
            }
            
            // Apply sort to this group
            this.applySortToGroup(group);
        },

        /**
         * Apply sort to specific group, considering independent sort settings
         * @param {object} group Group object
         */
        applySortToGroup(group) {
            if (!group || !group.monitorList || !Array.isArray(group.monitorList)) {
                return;
            }
            
            // Check if group has independent sort settings
            if (group.useOwnSort || !this.isGlobalSortActive) {
                // Use group's own sort settings
                const sortKey = group.sortKey || 'status';
                const sortDirection = group.sortDirection || 'desc';
                this.sortMonitorList(group.monitorList, sortKey, sortDirection);
            } else {
                // Use global sort settings
                this.sortMonitorList(group.monitorList, this.globalSortKey, this.globalSortDirection);
            }
        },

        /**
         * Apply sorting logic directly to the group's monitorList (in-place)
         * @param {object} group The group object containing monitorList
         */
        applySort(group) {
            this.applySortToGroup(group);
        },

        /**
         * Sort monitor list without modifying group's sort settings
         * @param {array} monitorList Monitor list to sort
         * @param {string} sortKey Sort key
         * @param {string} sortDirection Sort direction
         */
        sortMonitorList(monitorList, sortKey, sortDirection) {
            if (!Array.isArray(monitorList)) {
                return;
            }

            monitorList.sort((a, b) => {
                if (!a || !b) return 0;
                
                let comparison = 0;
                let valueA, valueB;

                if (sortKey === 'status') {
                    const getStatusPriority = (monitor) => {
                        if (!monitor || !monitor.id) return 4;
                        
                        // Ensure heartbeatList is available
                        const hbList = this.$root.heartbeatList || {};
                        const hbArr = hbList[monitor.id];
                        if (hbArr && hbArr.length > 0) {
                            const lastStatus = hbArr.at(-1).status;
                            if (lastStatus === 0) return 0; // Down
                            if (lastStatus === 1) return 1; // Up
                            if (lastStatus === 2) return 2; // Pending
                            if (lastStatus === 3) return 3; // Maintenance
                        }
                        return 4; // Unknown/No data - sort last
                    };
                    valueA = getStatusPriority(a);
                    valueB = getStatusPriority(b);
                } else if (sortKey === 'name') {
                    valueA = a.name ? a.name.toLowerCase() : '';
                    valueB = b.name ? b.name.toLowerCase() : '';
                } else if (sortKey === 'uptime') {
                    const uptimeList = this.$root.uptimeList || {};
                    const uptimeA = a.id ? parseFloat(uptimeList[`${a.id}_24`]) || 0 : 0;
                    const uptimeB = b.id ? parseFloat(uptimeList[`${b.id}_24`]) || 0 : 0;
                    valueA = uptimeA;
                    valueB = uptimeB;
                } else if (sortKey === 'cert') {
                    // Sort by certificate expiry time
                    // Valid certificates have remaining days, invalid or no certificates have -1
                    valueA = a.validCert && a.certExpiryDaysRemaining ? a.certExpiryDaysRemaining : -1;
                    valueB = b.validCert && b.certExpiryDaysRemaining ? b.certExpiryDaysRemaining : -1;
                }

                if (valueA < valueB) {
                    comparison = -1;
                } else if (valueA > valueB) {
                    comparison = 1;
                }

                // Special handling for status sorting only
                if (sortKey === 'status') {
                    return sortDirection === 'desc' ? (comparison * -1) : comparison;
                } else {
                    // Use pure sort result, without special handling for down servers
                    return sortDirection === 'asc' ? comparison : (comparison * -1);
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
         * @param {number} groupIndex Index of group to remove monitor
         * from
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
                return this.$root.monitorList[monitor.id].type === "http" || this.$root.monitorList[monitor.id].type === "keyword" || this.$root.monitorList[monitor.id].type === "json-query";
            }
            return monitor.sendUrl && monitor.url && monitor.url !== "https://";
        },

        /**
         * Returns formatted certificate expiry or Bad cert message
         * @param {object} monitor Monitor to show expiry for
         * @returns {string} Certificate expiry message
         */
        formattedCertExpiryMessage(monitor) {
            if (monitor?.validCert && monitor?.certExpiryDaysRemaining) {
                return monitor.certExpiryDaysRemaining + " " + this.$tc("day", monitor.certExpiryDaysRemaining);
            } else if (monitor?.validCert === false) {
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
            if (monitor?.validCert && monitor.certExpiryDaysRemaining > 7) {
                return "#059669";
            }
            return "#DC2626";
        },

        /**
         * Toggle global sort state
         */
        toggleGlobalSort() {
            this.isGlobalSortActive = !this.isGlobalSortActive;
            
            // Reset all groups' independent sort flags when toggling global sort state
            if (this.$root && this.$root.publicGroupList) {
                this.$root.publicGroupList.forEach(group => {
                    if (group) {
                        group.useOwnSort = false;
                    }
                });
            }
            
            // Save settings
            try {
                const storageKey = `uptime-kuma-global-sort-${this.slug}`;
                const globalSortSettings = {
                    key: this.globalSortKey,
                    direction: this.globalSortDirection,
                    active: this.isGlobalSortActive
                };
                localStorage.setItem(storageKey, JSON.stringify(globalSortSettings));
            } catch (error) {
                console.error('Cannot save global sort settings', error);
            }
            
            // Apply appropriate sorting based on global sort state
            if (this.isGlobalSortActive) {
                this.applyGlobalSort();
            } else {
                // Restore independent sorting for each group
                if (this.$root && this.$root.publicGroupList) {
                    this.$root.publicGroupList.forEach(group => {
                        if (group) {
                            this.applySort(group);
                        }
                    });
                }
            }
        },

        /**
         * Set global sort key and direction
         * @param {string} key The sort key ('status', 'name', 'uptime', 'cert')
         */
        setGlobalSort(key) {
            // Update global sort settings
            if (this.globalSortKey === key) {
                this.globalSortDirection = this.globalSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.globalSortKey = key;
                this.globalSortDirection = (key === 'status') ? 'desc' : 'asc';
            }
            
            // Activate global sort
            this.isGlobalSortActive = true;
            
            // Clear all groups' independent sort flags
            if (this.$root && this.$root.publicGroupList) {
                this.$root.publicGroupList.forEach(group => {
                    if (group) {
                        group.useOwnSort = false;
                    }
                });
            }
            
            // Save global sort settings to localStorage
            try {
                const storageKey = `uptime-kuma-global-sort-${this.slug}`;
                
                // Save global sort settings
                const globalSortSettings = {
                    key: this.globalSortKey,
                    direction: this.globalSortDirection,
                    active: this.isGlobalSortActive
                };
                localStorage.setItem(storageKey, JSON.stringify(globalSortSettings));
            } catch (error) {
                console.error('Cannot save global sort settings', error);
            }
            
            // Apply global sort
            this.applyGlobalSort();
        },

        /**
         * Disable global sort and restore independent sorting for each group
         */
        disableGlobalSort() {
            this.isGlobalSortActive = false;
            
            // Clear all groups' independent sort flags
            if (this.$root && this.$root.publicGroupList) {
                this.$root.publicGroupList.forEach(group => {
                    if (group) {
                        group.useOwnSort = false;
                    }
                });
            }
            
            // Save settings
            try {
                const storageKey = `uptime-kuma-global-sort-${this.slug}`;
                const globalSortSettings = {
                    key: this.globalSortKey,
                    direction: this.globalSortDirection,
                    active: false
                };
                localStorage.setItem(storageKey, JSON.stringify(globalSortSettings));
            } catch (error) {
                console.error('Cannot save global sort settings', error);
            }
            
            // Restore original sorting for each group
            if (this.$root && this.$root.publicGroupList) {
                this.$root.publicGroupList.forEach(group => {
                    if (group) {
                        this.applySort(group);
                    }
                });
            }
        },

        /**
         * Apply global sorting logic to all groups
         */
        applyGlobalSort() {
            if (!this.isGlobalSortActive || !this.$root || !this.$root.publicGroupList) {
                return;
            }
            
            // Apply global sort settings to all groups not using independent sorting
            this.$root.publicGroupList.forEach(group => {
                if (group && group.monitorList && !group.useOwnSort) {
                    // Use global sort settings for sorting
                    this.sortMonitorList(group.monitorList, this.globalSortKey, this.globalSortDirection);
                }
            });
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.group-container {
    margin-bottom: 2rem;
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e9ecef;
}

.group-title {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 500;
}

.search-container {
    margin-left: auto;
}

.search-input-wrapper {
    position: relative;
    display: flex;
}

.search-input {
    padding-right: 35px;
    width: 200px;
    font-size: 0.85rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background-color: #fff;
}

.search-button {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    padding: 0 10px;
    background: transparent;
    border: none;
    color: #6c757d;
    cursor: pointer;
}

.search-button:hover {
    color: #495057;
}

.sort-bar {
    padding: 0.5rem 0;
    margin-left: -1px;
    margin-right: -1px;
    width: calc(100% + 2px);
}

.sort-controls {
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
}

.sort-label {
    white-space: nowrap;
    margin-bottom: 0;
    font-weight: 500;
    color: #6c757d;
}

.sort-buttons {
    display: flex;
    flex-wrap: wrap;
}

.sort-button {
    padding: 0.25rem 0.75rem;
    margin-left: 0.25rem;
    margin-bottom: 0;
    background-color: #fff;
    border: 1px solid #dee2e6;
    color: #495057;
    transition: all 0.2s ease;
    white-space: nowrap;
    font-size: 0.8rem;
    border-radius: 4px;

    &:hover {
        background-color: #e9ecef;
        border-color: #ced4da;
    }

    &.active {
        background-color: #28a745;
        border-color: #28a745;
        color: white;
    }

    .fa-arrow-up,
    .fa-arrow-down {
        margin-left: 0.3em;
        font-size: 0.75rem;
    }
}

.monitor-list-container {
    position: relative;
}

.monitor-list {
    min-height: 46px;
    
    .item {
        padding: 0.75rem 1.25rem;
        border-bottom: 1px solid #f0f0f0;
        
        &:last-child {
            border-bottom: none;
        }
    }
}

.shadow-box {
    border-radius: 6px;
    overflow: hidden;
    background-color: #fff;
    border: 1px solid #e9ecef;
    
    .dark & {
        background-color: #2d3748;
        border-color: #4a5568;
    }
}

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

.mobile {
    .item {
        padding: 13px 0 10px;
    }
}

.bg-maintenance {
    background-color: $maintenance;
}

.global-controls-container {
    padding: 1rem;
    background-color: #fff;
    border-radius: 0.375rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.global-controls-title {
    text-align: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e9ecef;
    font-size: 1.25rem;
    font-weight: 500;
    color: #495057;
}

.global-controls-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.5rem; /* Slightly reduce padding for content */
}

.global-sort-controls {
    display: flex;
    align-items: center;

    .sort-label {
        white-space: nowrap;
        font-weight: 500;
        color: #6c757d;
        margin-right: 0.5rem;
        padding: 0.25rem 0.5rem; /* Add padding to label */
        border: 1px solid transparent; /* Match button border for alignment */
        border-radius: 4px; /* Match button radius */
    }

    .sort-buttons {
        display: flex;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        overflow: hidden;

        .sort-button {
            padding: 0.25rem 0.75rem;
            border-radius: 0;
            border: none;
            border-right: 1px solid #dee2e6;
            background-color: #fff;
            color: #495057;
            font-size: 0.8rem;
            transition: background-color 0.15s ease-in-out;

            &:last-child {
                border-right: none;
            }

            &:hover {
                background-color: #e9ecef;
            }

            &.active {
                background-color: #28a745;
                color: white;
            }

            .fa-arrow-up,
            .fa-arrow-down {
                margin-left: 0.3em;
                font-size: 0.75rem;
            }
        }
    }
}

.global-search-container {
    margin-left: 1rem; /* Space between sort and search */
    flex-grow: 1; /* Allow search to take remaining space */
    max-width: 400px; /* Limit max width */

    .input-group {
        position: relative;
        
        .form-control {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: #fff;
        }
        
        .btn {
            position: absolute;
            right: 1px; /* Position inside the input border */
            top: 1px;
            bottom: 1px;
            border-radius: 0 4px 4px 0;
            z-index: 3;
            background-color: transparent;
            border: none;
            padding: 0 0.75rem;
        }
    }
    
    small {
        display: none; /* Hide the 'Found X monitors' text */
    }
}

.dark {
    .global-controls-container {
        background-color: #2d3748;
        border-color: #4a5568;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .global-controls-title {
        border-bottom-color: #4a5568;
        color: #e2e8f0;
    }

    .global-sort-controls {
        .sort-label {
            color: $dark-font-color;
            border-color: transparent;
        }
        
        .sort-buttons {
            border-color: #4a5568;
            
            .sort-button {
                background-color: #1a202c;
                border-right-color: #4a5568;
                color: #e2e8f0;
                
                &:hover {
                    background-color: #4a5568;
                }
                
                &.active {
                    background-color: #28a745;
                    color: white;
                }
            }
        }
    }

    .global-search-container {
        .form-control {
            background-color: #1a202c;
            border-color: #4a5568;
            color: $dark-font-color;
        }
        
        .btn {
            color: $dark-font-color;
            
            &:hover {
                color: white;
            }
        }
    }
}

@media (max-width: 768px) {
    .group-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .search-container {
        margin-left: 0;
        margin-top: 0.5rem;
        width: 100%;
    }
    
    .search-input {
        width: 100%;
    }
    
    .sort-controls {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .sort-buttons {
        margin-top: 0.5rem;
    }
    
    .sort-button {
        margin-bottom: 0.5rem;
    }
}

</style>

