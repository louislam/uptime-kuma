<template>
    <div class="row">
        <div class="col-9 col-xl-6 small-padding">
            <div class="info">
                <font-awesome-icon
                    v-if="monitor.showChildMonitors && monitor.childrenList.length"
                    :icon="isExpanded ? 'chevron-down' : 'chevron-right'"
                    class="group-toggle-icon me-2"
                    @click.stop="toggleGroupExpand"
                />

                <font-awesome-icon
                    v-if="editMode && !isChild"
                    icon="arrows-alt-v"
                    class="action drag me-3"
                />

                <font-awesome-icon
                    v-if="editMode && !isChild"
                    icon="times"
                    class="action remove me-3"
                    @click.stop="onRemoveClick"
                />

                <font-awesome-icon
                    v-if="editMode && !isChild"
                    icon="cog"
                    class="action me-3 ms-0"
                    :class="{ 'link-active': true, 'btn-link': true }"
                    data-testid="monitor-settings"
                    @click.stop="onSettingsClick"
                />

                <span v-if="displayIndicator" class="nested-indicator">{{ displayIndicator }}</span>

                <Status
                    v-if="showOnlyLastHeartbeat"
                    :status="statusOfLastHeartbeat(monitor.id)"
                />
                <Uptime v-else :monitor="monitor" type="24" :pill="true" />

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

                <p v-else class="item-name" data-testid="monitor-name">
                    {{ monitor.name }}
                </p>
            </div>
            <div class="extra-info">
                <div
                    v-if="showCertificateExpiry && monitor.certExpiryDaysRemaining"
                >
                    <Tag
                        :item="{
                            name: $t('Cert Exp.'),
                            value: formattedCertExpiryMessage(monitor),
                            color: certExpiryColor(monitor),
                        }"
                        :size="'sm'"
                    />
                </div>
                <div v-if="showTags">
                    <Tag
                        v-for="tag in monitor.tags"
                        :key="tag"
                        :item="tag"
                        :size="'sm'"
                        data-testid="monitor-tag"
                    />
                </div>
            </div>
        </div>
        
        <div :key="heartbeatKey" class="col-6">
            <HeartbeatBar size="mid" :monitor-id="monitor.id" />
        </div>
    </div>

    <transition name="slide-fade-up">
        <div v-if="monitor.showChildMonitors && monitor.childrenList.length && isExpanded" class="nested-monitors">
            <div v-for="child in monitor.childrenList" :key="child.id" class="item nested-item" data-testid="nested-monitor">
                <PublicGroupRow
                    :monitor="child"
                    :show-tags="showTags"
                    :show-certificate-expiry="showCertificateExpiry"
                    :edit-mode="editMode"
                    :heartbeat-key="$root.userHeartbeatBar"
                    name-test-id="nested-monitor-name"
                    :is-child="true"
                />
            </div>
        </div>
    </transition>
</template>

<script>
import HeartbeatBar from "./HeartbeatBar.vue";
import Status from "./Status.vue";
import Uptime from "./Uptime.vue";
import Tag from "./Tag.vue";


export default {
    name: "PublicGroupRow",
    components: {
        Uptime,
        HeartbeatBar,
        Tag,
        Status,
    },
    props: {
        /** Monitor or group element to display */
        monitor: {
            type: Object,
            required: true
        },

        /** Callback for remove click */
        onRemove: {
            type: Function,
            default: null,
        },

            /** Callback for settings click */
        onSettings: {
            type: Function,
            default: null,
        },

        /** Is this a child monitor of monitor with group type */
        isChild: {
            type: Boolean,
            default: false,
        },

        /** Should tags be shown? */
        showTags: {
            type: Boolean,
            default: false,
        },

        /** Should expiry be shown? */
        showCertificateExpiry: {
            type: Boolean,
            default: false,
        },

        /** Are we in edit mode? */
        editMode: {
            type: Boolean,
            required: true,
        },

        /** Key to force re-rendering of HeartbeatBar */
        heartbeatKey: {
            type: [ String, Number ],
            default: null,
        },

        /** Indicator to show before the item name */
        indicator: {
            type: String,
            default: "",
        },

        /** Should only the last heartbeat be shown? */
        showOnlyLastHeartbeat: {
            type: Boolean,
        },
    },
    data() {
        return {
            isExpanded: false,
        };
    },
    computed: {
        displayIndicator() {
            if (this.indicator) {
                return this.indicator;
            }

            if (this.isChild) {
                return "└─";
            }

            return "";
        }
    },
    beforeMount() {
        try {
            const storage = window.localStorage.getItem("publicGroupRowExpanded");
            if (storage) {
                const obj = JSON.parse(storage);
                if (obj[`monitor_${this.monitor.id}`] != null) {
                    this.isExpanded = obj[`monitor_${this.monitor.id}`];
                }
            }
        } catch (e) {
            // ignore
        }
    },
    methods: {
        /**
         * Toggle expand/collapse state for a group row
         * @returns {void}
         */
        toggleGroupExpand() {
            this.isExpanded = !this.isExpanded;

            try {
                let storage = window.localStorage.getItem("publicGroupRowExpanded");
                let storageObject = {};
                if (storage !== null) {
                    storageObject = JSON.parse(storage);
                }
                storageObject[`monitor_${this.monitor.id}`] = this.isExpanded;
                window.localStorage.setItem("publicGroupRowExpanded", JSON.stringify(storageObject));
            } catch (e) {
                // ignore
            }
        },
        /**
         * Handle remove click
         * @param {Event} e Click event
         * @returns {void}
         */
        onRemoveClick(e) {
            e.stopPropagation();
            if (this.onRemove) {
                this.onRemove();
            }
        },
        /**
         * Handle settings click
         * @param {Event} e Click event
         * @returns {void}
         */
        onSettingsClick(e) {
            e.stopPropagation();
            if (this.onSettings) {
                this.onSettings();
            }
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
            if (this.editMode && ignoreSendUrl && Object.keys(this.$root.monitorList || {}).length) {
                const m = this.$root.monitorList[monitor.id];
                return m && (m.type === "http" || m.type === "keyword" || m.type === "json-query");
            }

            return monitor.sendUrl && monitor.url && monitor.url !== "https://";
        },

        /**
         * Returns formatted certificate expiry or Bad cert message
         * @param {object} monitor Element to show expiry for
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
         * @param {object} monitor Element to show expiry for
         * @returns {string} Color for certificate expiry
         */
        certExpiryColor(monitor) {
            if (monitor?.validCert && monitor.certExpiryDaysRemaining > 7) {
                return "#059669";
            }

            return "#DC2626";
        },

        /**
         * Returns the status of the last heartbeat
         * @param {number} monitorId Id of the monitor to get status for
         * @returns {number} Status of the last heartbeat
         */
        statusOfLastHeartbeat(monitorId) {
            let heartbeats = this.$root.heartbeatList[monitorId] ?? [];
            let lastHeartbeat = heartbeats[heartbeats.length - 1];
            return lastHeartbeat?.status;
        },

    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.nested-indicator {
    color: #999;
    margin-right: 5px;
    font-family: monospace;
}

.group-toggle-icon {
    cursor: pointer;
    color: #666;
    transition: color 0.2s ease;
    font-size: 0.9em;
}

.group-toggle-icon:hover {
    color: $primary;
}

.dark .group-toggle-icon {
    color: #aaa;
}

.dark .group-toggle-icon:hover {
    color: $primary;
}

.item-name {
    padding-left: 5px;
    padding-right: 5px;
    margin: 0;
    display: inline-block;
}

.nested-item {
    background-color: rgba(0, 0, 0, 0.05);
    border-left: 3px solid rgba(0, 0, 0, 0.1);
}

.dark .nested-item {
    background-color: rgba(255, 255, 255, 0.02);
    border-left: 3px solid rgba(255, 255, 255, 0.1);
}

.nested-monitors {
    margin-left: 0;
    margin-top: 0;
    animation: slide-down 0.3s ease-out;
    overflow: hidden;
}

@keyframes slide-down {
    from {
        opacity: 0;
        max-height: 0;
    }

    to {
        opacity: 1;
        max-height: 2000px;
    }
}

</style>
