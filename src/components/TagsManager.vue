<template>
    <div>
        <h4 class="mt-5 mb-3">{{ $t("Tags") }}</h4>
        <div v-if="selectedTags.length > 0" class="mb-2 p-1">
            <tag
                v-for="item in selectedTags"
                :key="item.id"
                :item="item"
                :remove="deleteTag"
            />
        </div>
        <div class="p-1">
            <button
                type="button"
                class="btn btn-outline-secondary btn-add"
                :disabled="processing"
                data-testid="add-tag-button"
                @click.stop="showAddDialog"
            >
                <font-awesome-icon class="me-1" icon="plus" /> {{ $t("Add") }}
            </button>
        </div>
        <div ref="modal" class="modal fade" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body">
                        <vue-multiselect
                            v-model="newDraftTag.select"
                            class="mb-2"
                            :options="tagOptions"
                            :multiple="false"
                            :searchable="true"
                            :placeholder="$t('Add New below or Select...')"
                            track-by="id"
                            label="name"
                        >
                            <template #option="{ option }">
                                <div
                                    class="mx-2 py-1 px-3 rounded d-inline-flex"
                                    style="margin-top: -5px; margin-bottom: -5px; height: 24px;"
                                    :style="{ color: textColor(option), backgroundColor: option.color + ' !important' }"
                                >
                                    <span>
                                        {{ option.name }}</span>
                                </div>
                            </template>
                            <template #singleLabel="{ option }">
                                <div
                                    class="py-1 px-3 rounded d-inline-flex"
                                    style="height: 24px;"
                                    :style="{ color: textColor(option), backgroundColor: option.color + ' !important' }"
                                >
                                    <span>{{ option.name }}</span>
                                </div>
                            </template>
                        </vue-multiselect>
                        <div v-if="newDraftTag.select?.name == null" class="d-flex mb-2">
                            <div class="w-50 pe-2">
                                <input
                                    v-model="newDraftTag.name" class="form-control"
                                    :class="{'is-invalid': validateDraftTag.nameInvalid}"
                                    :placeholder="$t('Name')"
                                    data-testid="tag-name-input"
                                    @keydown.enter.prevent="onEnter"
                                />
                                <div class="invalid-feedback">
                                    {{ $t("Tag with this name already exist.") }}
                                </div>
                            </div>
                            <div class="w-50 ps-2">
                                <vue-multiselect
                                    v-model="newDraftTag.color"
                                    :options="colorOptions"
                                    :multiple="false"
                                    :searchable="true"
                                    :placeholder="$t('color')"
                                    track-by="color"
                                    label="name"
                                    select-label=""
                                    deselect-label=""
                                    data-testid="tag-color-select"
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
                        </div>
                        <div class="mb-2">
                            <input
                                v-model="newDraftTag.value" class="form-control"
                                :class="{'is-invalid': validateDraftTag.valueInvalid}"
                                :placeholder="$t('value (optional)')"
                                data-testid="tag-value-input"
                                @keydown.enter.prevent="onEnter"
                            />
                            <div class="invalid-feedback">
                                {{ $t("Tag with this value already exist.") }}
                            </div>
                        </div>
                        <div class="mb-2">
                            <button
                                type="button"
                                class="btn btn-secondary float-end"
                                :disabled="processing || validateDraftTag.invalid"
                                data-testid="tag-submit-button"
                                @click.stop="addDraftTag"
                            >
                                {{ $t("Add") }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";
import VueMultiselect from "vue-multiselect";
import { colorOptions } from "../util-frontend";
import Tag from "../components/Tag.vue";

/**
 * @typedef Tag
 * @type {object}
 * @property {number | undefined} id ID of tag assignment
 * @property {number | undefined} monitor_id ID of monitor tag is
 * assigned to
 * @property {number | undefined} tag_id ID of tag
 * @property {string} value Value given to tag
 * @property {string} name Name of tag
 * @property {string} color Colour of tag
 * @property {boolean | undefined} new Should a new tag be created?
 */

export default {
    components: {
        Tag,
        VueMultiselect,
    },
    props: {
        /**
         * Array of tags to be pre-selected
         * @type {Tag[]}
         */
        preSelectedTags: {
            type: Array,
            default: () => [],
        },
    },
    data() {
        return {
            /** @type {Modal | null} */
            modal: null,
            /** @type {Tag[]} */
            existingTags: [],
            processing: false,
            /** @type {Tag[]} */
            newTags: [],
            /** @type {Tag[]} */
            deleteTags: [],
            newDraftTag: {
                name: null,
                select: null,
                color: null,
                value: "",
                invalid: true,
                nameInvalid: false,
            },
        };
    },
    computed: {
        tagOptions() {
            const tagOptions = this.existingTags;
            for (const tag of this.newTags) {
                if (!tagOptions.find(t => t.name === tag.name && t.color === tag.color)) {
                    tagOptions.push(tag);
                }
            }
            return tagOptions;
        },
        selectedTags() {
            return this.preSelectedTags.concat(this.newTags).filter(tag => !this.deleteTags.find(monitorTag => monitorTag.tag_id === tag.tag_id));
        },
        colorOptions() {
            return colorOptions(this);
        },
        validateDraftTag() {
            let nameInvalid = false;
            let valueInvalid = false;
            let invalid = true;
            if (this.deleteTags.find(tag => tag.name === this.newDraftTag.select?.name && tag.value === this.newDraftTag.value)) {
                // Undo removing a Tag
                nameInvalid = false;
                valueInvalid = false;
                invalid = false;
            } else if (this.existingTags.filter(tag => tag.name === this.newDraftTag.name).length > 0 && this.newDraftTag.select == null) {
                // Try to create new tag with existing name
                nameInvalid = true;
                invalid = true;
            } else if (this.newTags.concat(this.preSelectedTags).filter(tag => (
                tag.name === this.newDraftTag.select?.name && tag.value === this.newDraftTag.value
            ) || (
                tag.name === this.newDraftTag.name && tag.value === this.newDraftTag.value
            )).length > 0) {
                // Try to add a tag with existing name and value
                valueInvalid = true;
                invalid = true;
            } else if (this.newDraftTag.select != null) {
                // Select an existing tag, no need to validate
                invalid = false;
                valueInvalid = false;
            } else if (this.newDraftTag.color == null || this.newDraftTag.name === "") {
                // Missing form inputs
                nameInvalid = false;
                invalid = true;
            } else {
                // Looks valid
                invalid = false;
                nameInvalid = false;
                valueInvalid = false;
            }
            return {
                invalid,
                nameInvalid,
                valueInvalid,
            };
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
        this.getExistingTags();
    },
    methods: {
        /**
         * Show the add tag dialog
         * @returns {void}
         */
        showAddDialog() {
            this.modal.show();
        },
        /**
         * Get all existing tags
         * @returns {void}
         */
        getExistingTags() {
            this.$root.getSocket().emit("getTags", (res) => {
                if (res.ok) {
                    this.existingTags = res.tags;
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        /**
         * Delete the specified tag
         * @param {object} item Object representing tag to delete
         * @returns {void}
         */
        deleteTag(item) {
            if (item.new) {
                // Undo Adding a new Tag
                this.newTags = this.newTags.filter(tag => !(tag.name === item.name && tag.value === item.value));
            } else {
                // Remove an Existing Tag
                this.deleteTags.push(item);
            }
        },
        /**
         * Get colour of text inside the tag
         * @param {object} option The tag that needs to be displayed.
         * Defaults to "white" unless the tag has no color, which will
         * then return the body color (based on application theme)
         * @returns {string} Text color
         */
        textColor(option) {
            if (option.color) {
                return "white";
            } else {
                return this.$root.theme === "light" ? "var(--bs-body-color)" : "inherit";
            }
        },
        /**
         * Add a draft tag
         * @returns {void}
         */
        addDraftTag() {
            console.log("Adding Draft Tag: ", this.newDraftTag);
            if (this.newDraftTag.select != null) {
                if (this.deleteTags.find(tag => tag.name === this.newDraftTag.select.name && tag.value === this.newDraftTag.value)) {
                    // Undo removing a tag
                    this.deleteTags = this.deleteTags.filter(tag => !(tag.name === this.newDraftTag.select.name && tag.value === this.newDraftTag.value));
                } else {
                    // Add an existing Tag
                    this.newTags.push({
                        id: this.newDraftTag.select.id,
                        color: this.newDraftTag.select.color,
                        name: this.newDraftTag.select.name,
                        value: this.newDraftTag.value,
                        new: true,
                    });
                }
            } else {
                // Add new Tag
                this.newTags.push({
                    color: this.newDraftTag.color.color,
                    name: this.newDraftTag.name.trim(),
                    value: this.newDraftTag.value,
                    new: true,
                });
            }
            this.clearDraftTag();
        },
        /**
         * Remove a draft tag
         * @returns {void}
         */
        clearDraftTag() {
            this.newDraftTag = {
                name: null,
                select: null,
                color: null,
                value: "",
                invalid: true,
                nameInvalid: false,
            };
            this.modal.hide();
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
        /**
         * Handle pressing Enter key when inside the modal
         * @returns {void}
         */
        onEnter() {
            if (!this.validateDraftTag.invalid) {
                this.addDraftTag();
            }
        },
        /**
         * Submit the form data
         * @param {number} monitorId ID of monitor this change affects
         * @returns {Promise<void>}
         */
        async submit(monitorId) {
            console.log(`Submitting tag changes for monitor ${monitorId}...`);
            this.processing = true;

            for (const newTag of this.newTags) {
                let tagId;
                if (newTag.id == null) {
                    // Create a New Tag
                    let newTagResult;
                    await this.addTagAsync(newTag).then((res) => {
                        if (!res.ok) {
                            this.$root.toastError(res.msg);
                            newTagResult = false;
                        }
                        newTagResult = res.tag;
                    });
                    if (!newTagResult) {
                        // abort
                        this.processing = false;
                        return;
                    }
                    tagId = newTagResult.id;
                    // Assign the new ID to the tags of the same name & color
                    this.newTags.map(tag => {
                        if (tag.name === newTag.name && tag.color === newTag.color) {
                            tag.id = newTagResult.id;
                        }
                    });
                } else {
                    tagId = newTag.id;
                }

                let newMonitorTagResult;
                // Assign tag to monitor
                await this.addMonitorTagAsync(tagId, monitorId, newTag.value).then((res) => {
                    if (!res.ok) {
                        this.$root.toastError(res.msg);
                        newMonitorTagResult = false;
                    }
                    newMonitorTagResult = true;
                });
                if (!newMonitorTagResult) {
                    // abort
                    this.processing = false;
                    return;
                }
            }

            for (const deleteTag of this.deleteTags) {
                let deleteMonitorTagResult;
                await this.deleteMonitorTagAsync(deleteTag.tag_id, deleteTag.monitor_id, deleteTag.value).then((res) => {
                    if (!res.ok) {
                        this.$root.toastError(res.msg);
                        deleteMonitorTagResult = false;
                    }
                    deleteMonitorTagResult = true;
                });
                if (!deleteMonitorTagResult) {
                    // abort
                    this.processing = false;
                    return;
                }
            }

            this.getExistingTags();
            this.newTags = [];
            this.deleteTags = [];
            this.processing = false;
        }
    },
};
</script>

<style scoped>
.btn-add {
    width: 100%;
}

.modal-body {
    padding: 1.5rem;
}
</style>
