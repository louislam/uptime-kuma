<template>
    <div ref="MonitorSettingDialog" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("Monitor Setting", [monitor.name]) }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div class="my-3 form-check">
                        <input id="show-clickable-link" v-model="monitor.isClickAble" class="form-check-input" type="checkbox" data-testid="show-clickable-link" @click="toggleLink(monitor.group_index, monitor.monitor_index)" />
                        <label class="form-check-label" for="show-clickable-link">
                            {{ $t("Show Clickable Link") }}
                        </label>
                        <div class="form-text">
                            {{ $t("Show Clickable Link Description") }}
                        </div>
                    </div>

                    <!-- Custom URL -->
                    <template v-if="monitor.isClickAble">
                        <label for="customUrl" class="form-label">{{ $t("Custom URL") }}</label>
                        <input id="customUrl" :value="monitor.url" type="url" class="form-control" data-testid="custom-url-input" @input="e => changeUrl(monitor.group_index, monitor.monitor_index, e.target!.value)">

                        <div class="form-text mb-3">
                            {{ $t("customUrlDescription") }}
                        </div>
                    </template>

                    <button
                        class="btn btn-primary btn-add-group me-2"
                        @click="$refs.badgeGeneratorDialog.show(monitor.id, monitor.name)"
                    >
                        <font-awesome-icon icon="certificate" />
                        {{ $t("Open Badge Generator") }}
                    </button>
                </div>

                <div class="modal-footer">
                    <button type="submit" class="btn btn-danger" data-bs-dismiss="modal" data-testid="monitor-settings-close">
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
    <BadgeGeneratorDialog ref="badgeGeneratorDialog" />
</template>

<script lang="ts">
import { Modal } from "bootstrap";
import BadgeGeneratorDialog from "./BadgeGeneratorDialog.vue";

export default {
    components: {
        BadgeGeneratorDialog
    },
    props: {},
    emits: [],
    data() {
        return {
            monitor: {
                id: null,
                name: null,
            },
        };
    },

    computed: {},

    mounted() {
        this.MonitorSettingDialog = new Modal(this.$refs.MonitorSettingDialog);
    },

    methods: {
        /**
         * Setting monitor
         * @param {object} group Data of monitor
         * @param {object} monitor Data of monitor
         * @returns {void}
         */
        show(group, monitor) {
            this.monitor = {
                id: monitor.element.id,
                name: monitor.element.name,
                monitor_index: monitor.index,
                group_index: group.index,
                isClickAble: this.showLink(monitor),
                url: monitor.element.url,
            };

            this.MonitorSettingDialog.show();
        },

        /**
         * Toggle the value of sendUrl
         * @param {number} groupIndex Index of group monitor is member of
         * @param {number} index Index of monitor within group
         * @returns {void}
         */
        toggleLink(groupIndex, index) {
            this.$root.publicGroupList[groupIndex].monitorList[index].sendUrl = !this.$root.publicGroupList[groupIndex].monitorList[index].sendUrl;
        },

        /**
         * Should a link to the monitor be shown?
         * Attempts to guess if a link should be shown based upon if
         * sendUrl is set and if the URL is default or not.
         * @param {object} monitor Monitor to check
         * @param {boolean} ignoreSendUrl Should the presence of the sendUrl
         * property be ignored. This will only work in edit mode.
         * @returns {boolean} Should the link be shown?
         */
        showLink(monitor, ignoreSendUrl = false) {
            // We must check if there are any elements in monitorList to
            // prevent undefined errors if it hasn't been loaded yet
            if (this.$parent.editMode && ignoreSendUrl && Object.keys(this.$root.monitorList).length) {
                return this.$root.monitorList[monitor.element.id].type === "http" || this.$root.monitorList[monitor.element.id].type === "keyword" || this.$root.monitorList[monitor.element.id].type === "json-query";
            }
            return monitor.element.sendUrl && monitor.element.url && monitor.element.url !== "https://" && !this.editMode;
        },

        /**
         * Toggle the value of sendUrl
         * @param {number} groupIndex Index of group monitor is member of
         * @param {number} index Index of monitor within group
         * @param {string} value The new value of the url
         * @returns {void}
         */
        changeUrl(groupIndex, index, value) {
            this.$root.publicGroupList[groupIndex].monitorList[index].url = value;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text, .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
