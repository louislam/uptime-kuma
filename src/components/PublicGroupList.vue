<template>
    <!-- Group List -->
    <Draggable v-model="$root.publicGroupList" :disabled="!editMode" item-key="id" :animation="100">
        <template #item="group">
            <div class="mb-5" data-testid="group">
                <!-- Group Title -->
                <h2 class="group-title">
                    <div class="title-section">
                        <font-awesome-icon
                            v-if="editMode && showGroupDrag"
                            icon="arrows-alt-v"
                            class="action drag me-3"
                        />
                        <font-awesome-icon
                            v-if="editMode"
                            icon="times"
                            class="action remove me-3"
                            @click="removeGroup(group.index)"
                        />
                        <Editable
                            v-model="group.element.name"
                            :contenteditable="editMode"
                            tag="span"
                            data-testid="group-name"
                        />
                    </div>

                    <GroupSortDropdown
                        :group="group.element"
                        :group-index="group.index"
                        :show-certificate-expiry="showCertificateExpiry"
                        @update-group="updateGroup"
                    />
                </h2>

                <div class="shadow-box monitor-list mt-4 position-relative">
                    <div v-if="group.element.monitorList.length === 0" class="text-center no-monitor-msg">
                        {{ $t("No Monitors") }}
                    </div>

                    <!-- Monitor List -->
                    <!-- animation is not working, no idea why -->
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
                                <PublicGroupRow
                                    :monitor="monitor.element"
                                    :on-remove="() => removeMonitor(group.index, monitor.index)"
                                    :on-settings="() => $refs.monitorSettingDialog.show(group, monitor)"
                                    :show-tags="showTags"
                                    :show-certificate-expiry="showCertificateExpiry"
                                    :edit-mode="editMode"
                                    :heartbeat-key="$root.userHeartbeatBar"
                                    :show-only-last-heartbeat="showOnlyLastHeartbeat"
                                />
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
import PublicGroupRow from "./PublicGroupRow.vue";
import GroupSortDropdown from "./GroupSortDropdown.vue";

export default {
    components: {
        MonitorSettingDialog,
        Draggable,
        PublicGroupRow,
        GroupSortDropdown,
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
        /** Should only the last heartbeat be shown? */
        showOnlyLastHeartbeat: {
            type: Boolean,
        },
    },
    data() {
        return {};
    },
    computed: {
        showGroupDrag() {
            return this.$root.publicGroupList.length >= 2;
        },
    },
    watch: {
        // No watchers needed - sorting is handled by GroupSortDropdown component
    },
    created() {
        // Sorting is now handled by GroupSortDropdown component
    },
    methods: {
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
         * Update group properties
         * @param {number} groupIndex Index of group to update
         * @param {object} updates Object with properties to update
         * @returns {void}
         */
        updateGroup(groupIndex, updates) {
            Object.assign(this.$root.publicGroupList[groupIndex], updates);
        },
    },
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

.mobile {
    .item {
        padding: 13px 0 10px;
    }

    .group-title {
        flex-direction: column;
        align-items: flex-start;
    }
}

.bg-maintenance {
    background-color: $maintenance;
}
</style>
