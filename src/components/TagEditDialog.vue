<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Edit Tag") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="tag-name" class="form-label">{{ $t("Name") }}</label>
                            <input
                                id="tag-name"
                                v-model="tag.name"
                                type="text"
                                class="form-control"
                                :class="{'is-invalid': nameInvalid}"
                                required
                            >
                            <div class="invalid-feedback">
                                {{ $t("Tag with this name already exist.") }}
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="tag-color" class="form-label">{{ $t("color") }}</label>
                            <div class="d-flex">
                                <div class="col-8 pe-1">
                                    <vue-multiselect
                                        v-model="selectedColor"
                                        :options="colorOptions"
                                        :multiple="false"
                                        :searchable="true"
                                        :placeholder="$t('color')"
                                        track-by="color"
                                        label="name"
                                        select-label=""
                                        deselect-label=""
                                    >
                                        <template #option="{ option }">
                                            <div
                                                class="mx-2 py-1 px-3 rounded d-inline-flex"
                                                style="height: 24px; color: white;"
                                                :style="{ backgroundColor: option.color + ' !important' }"
                                            >
                                                <span>{{ option.name }}</span>
                                            </div>
                                        </template>
                                        <template #singleLabel="{ option }">
                                            <div
                                                class="py-1 px-3 rounded d-inline-flex"
                                                style="height: 24px; color: white;"
                                                :style="{ backgroundColor: option.color + ' !important' }"
                                            >
                                                <span>{{ option.name }}</span>
                                            </div>
                                        </template>
                                    </vue-multiselect>
                                </div>
                                <div class="col-4 ps-1">
                                    <input id="tag-color-hex" v-model="tag.color" type="text" class="form-control">
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="tag-monitors" class="form-label">{{ $tc("Monitor", selectedMonitors.length) }}</label>
                            <div class="tag-monitors-list">
                                <router-link v-for="monitor in selectedMonitors" :key="monitor.id" class="d-flex align-items-center justify-content-between text-decoration-none tag-monitors-list-row py-2 px-3" :to="monitorURL(monitor.id)" @click="modal.hide()">
                                    <span>{{ monitor.name }}</span>
                                    <button type="button" class="btn-rm-monitor btn btn-outline-danger ms-2 py-1" @click.stop.prevent="removeMonitor(monitor.id)">
                                        <font-awesome-icon class="" icon="times" />
                                    </button>
                                </router-link>
                            </div>
                            <div v-if="allMonitorList.length > 0" class="pt-3">
                                <label class="form-label">{{ $t("Add a monitor") }}:</label>
                                <VueMultiselect
                                    v-model="selectedAddMonitor"
                                    :options="allMonitorList"
                                    :multiple="false"
                                    :searchable="true"
                                    :placeholder="$t('Add a monitor')"
                                    label="name"
                                    trackBy="name"
                                    class="mt-1"
                                >
                                    <template #option="{ option }">
                                        <div class="d-inline-flex">
                                            <span>{{ option.name }} <Tag v-for="monitorTag in option.tags" :key="monitorTag" :item="monitorTag" :size="'sm'" /></span>
                                        </div>
                                    </template>
                                </VueMultiselect>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button v-if="tag && tag.id !== null" type="button" class="btn btn-danger" :disabled="processing" @click="deleteConfirm">
                            {{ $t("Delete") }}
                        </button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">
                            <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteTag">
        {{ $t("confirmDeleteTagMsg") }}
    </Confirm>
</template>

<script>
import { Modal } from "bootstrap";
import Confirm from "./Confirm.vue";
import Tag from "./Tag.vue";
import VueMultiselect from "vue-multiselect";
import { colorOptions } from "../util-frontend";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    components: {
        VueMultiselect,
        Confirm,
        Tag,
    },
    props: {
        updated: {
            type: Function,
            default: () => {},
        },
        existingTags: {
            type: Array,
            default: () => [],
        },
    },
    data() {
        return {
            modal: null,
            processing: false,
            selectedColor: {
                name: null,
                color: null,
            },
            tag: {
                id: null,
                name: "",
                color: "",
                // Do not set default value here, please scroll to show()
            },
            monitors: [],
            removingMonitor: [],
            addingMonitor: [],
            selectedAddMonitor: null,
            nameInvalid: false,
        };
    },

    computed: {
        colorOptions() {
            if (!colorOptions(this).find(option => option.color === this.tag.color)) {
                return colorOptions(this).concat(
                    {
                        name: "custom",
                        color: this.tag.color
                    });
            } else {
                return colorOptions(this);
            }
        },
        selectedMonitors() {
            return this.monitors
                .concat(Object.values(this.$root.monitorList).filter(monitor => this.addingMonitor.includes(monitor.id)))
                .filter(monitor => !this.removingMonitor.includes(monitor.id));
        },
        allMonitorList() {
            return Object.values(this.$root.monitorList).filter(monitor => !this.selectedMonitors.includes(monitor));
        },
    },

    watch: {
        // Set color option to "Custom" when a unknown color is entered
        "tag.color"(to, from) {
            if (to !== "" && colorOptions(this).find(x => x.color === to) == null) {
                this.selectedColor.name = this.$t("Custom");
                this.selectedColor.color = to;
            }
        },
        "tag.name"(to, from) {
            if (to != null) {
                this.validate();
            }
        },
        selectedColor(to, from) {
            if (to != null) {
                this.tag.color = to.color;
            }
        },
        /**
         * Selected a monitor and add to the list.
         * @param {object} monitor Monitor to add
         * @returns {void}
         */
        selectedAddMonitor(monitor) {
            if (monitor) {
                if (this.removingMonitor.includes(monitor.id)) {
                    this.removingMonitor = this.removingMonitor.filter(id => id !== monitor.id);
                } else {
                    this.addingMonitor.push(monitor.id);
                }
                this.selectedAddMonitor = null;
            }
        },
    },

    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },

    methods: {
        /**
         * Show confirmation for deleting a tag
         * @returns {void}
         */
        deleteConfirm() {
            this.$refs.confirmDelete.show();
        },

        /**
         * Reset the editTag form
         * @returns {void}
         */
        reset() {
            this.selectedColor = null;
            this.tag = {
                id: null,
                name: "",
                color: "",
            };
            this.monitors = [];
            this.removingMonitor = [];
            this.addingMonitor = [];
        },

        /**
         * Check for existing tags of the same name, set invalid input
         * @returns {boolean} True if editing tag is valid
         */
        validate() {
            this.nameInvalid = false;
            const sameName = this.existingTags.find((existingTag) => existingTag.name === this.tag.name);
            if (sameName != null && sameName.id !== this.tag.id) {
                this.nameInvalid = true;
                return false;
            }
            return true;
        },

        /**
         * Load tag information for display in the edit dialog
         * @param {object} tag tag object to edit
         * @returns {void}
         */
        show(tag) {
            if (tag) {
                this.selectedColor = this.colorOptions.find(x => x.color === tag.color) ?? {
                    name: this.$t("Custom"),
                    color: tag.color
                };
                this.tag.id = tag.id;
                this.tag.name = tag.name;
                this.tag.color = tag.color;
                this.monitors = this.monitorsByTag(tag.id);
                this.removingMonitor = [];
                this.addingMonitor = [];
                this.selectedAddMonitor = null;
            }

            this.modal.show();
        },

        /**
         * Submit tag and monitorTag changes to server
         * @returns {Promise<void>}
         */
        async submit() {
            this.processing = true;
            let editResult = true;

            if (!this.validate()) {
                this.processing = false;
                return;
            }

            if (this.tag.id == null) {
                await this.addTagAsync(this.tag).then((res) => {
                    if (!res.ok) {
                        this.$root.toastRes(res.msg);
                        editResult = false;
                    } else {
                        this.tag.id = res.tag.id;
                        this.updated();
                    }
                });
            }

            if (!editResult) {
                return;
            }

            for (let addId of this.addingMonitor) {
                await this.addMonitorTagAsync(this.tag.id, addId, "").then((res) => {
                    if (!res.ok) {
                        this.$root.toastError(res.msg);
                        editResult = false;
                    }
                });
            }

            for (let removeId of this.removingMonitor) {
                this.monitors.find(monitor => monitor.id === removeId)?.tags.forEach(async (monitorTag) => {
                    await this.deleteMonitorTagAsync(this.tag.id, removeId, monitorTag.value).then((res) => {
                        if (!res.ok) {
                            this.$root.toastError(res.msg);
                            editResult = false;
                        }
                    });
                });
            }

            this.$root.getSocket().emit("editTag", this.tag, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok && editResult) {
                    this.updated();
                    this.modal.hide();
                }
            });
        },

        /**
         * Delete the editing tag from server
         * @returns {Promise<void>}
         */
        async deleteTag() {
            this.processing = true;
            await this.deleteTagAsync(this.tag.id).then((res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.updated();
                    this.modal.hide();
                }
            });
        },

        /**
         * Remove a monitor from the monitors list locally
         * @param {number} id id of the tag to remove
         * @returns {void}
         */
        removeMonitor(id) {
            if (this.addingMonitor.includes(id)) {
                this.addingMonitor = this.addingMonitor.filter(x => x !== id);
            } else {
                this.removingMonitor.push(id);
            }
        },

        /**
         * Get monitors which has a specific tag locally
         * @param {number} tagId id of the tag to filter
         * @returns {object[]} list of monitors which has a specific tag
         */
        monitorsByTag(tagId) {
            return Object.values(this.$root.monitorList).filter((monitor) => {
                return monitor.tags.find(monitorTag => monitorTag.tag_id === tagId);
            });
        },

        /**
         * Get URL of monitor
         * @param {number} id ID of monitor
         * @returns {string} Relative URL of monitor
         */
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },

        /**
         * Add a tag asynchronously
         * @param {object} newTag Object representing new tag to add
         * @returns {Promise<void>}
         */
        addTagAsync(newTag) {
            return new Promise((resolve) => {
                this.$root.getSocket().emit("addTag", newTag, resolve);
            });
        },

        /**
         * Delete a tag asynchronously
         * @param {number} tagId ID of tag to delete
         * @returns {Promise<void>}
         */
        deleteTagAsync(tagId) {
            return new Promise((resolve) => {
                this.$root.getSocket().emit("deleteTag", tagId, resolve);
            });
        },

        /**
         * Add a tag to a monitor asynchronously
         * @param {number} tagId ID of tag to add
         * @param {number} monitorId ID of monitor to add tag to
         * @param {string} value Value of tag
         * @returns {Promise<void>}
         */
        addMonitorTagAsync(tagId, monitorId, value) {
            return new Promise((resolve) => {
                this.$root.getSocket().emit("addMonitorTag", tagId, monitorId, value, resolve);
            });
        },
        /**
         * Delete a tag from a monitor asynchronously
         * @param {number} tagId ID of tag to remove
         * @param {number} monitorId ID of monitor to remove tag from
         * @param {string} value Value of tag
         * @returns {Promise<void>}
         */
        deleteMonitorTagAsync(tagId, monitorId, value) {
            return new Promise((resolve) => {
                this.$root.getSocket().emit("deleteMonitorTag", tagId, monitorId, value, resolve);
            });
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

.btn-rm-monitor {
    padding-left: 11px;
    padding-right: 11px;
}

.tag-monitors-list {
    max-height: 40vh;
    overflow-y: scroll;
}

.tag-monitors-list .tag-monitors-list-row {
    cursor: pointer;
    border-bottom: 1px solid rgba(0, 0, 0, 0.125);

    .dark & {
        border-bottom: 1px solid $dark-border-color;
    }

    &:hover {
        background-color: $highlight-white;
    }

    .dark &:hover {
        background-color: $dark-bg2;
    }
}

</style>
