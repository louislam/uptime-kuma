<template>
    <div>
        <h4 class="mt-5 mb-3">{{ $t("Tags") }}</h4>
        <div v-if="selectedTags.length > 0" class="mb-2 p-1">
            <tag
                v-for="item in selectedTags"
                :key="`${item.tag_id || item.id}-${item.value || ''}`"
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
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body">
                        <h4 v-if="stagedForBatchAdd.length > 0">{{ $t("Add Tags") }}</h4>
                        <div v-if="stagedForBatchAdd.length > 0" class="mb-3 staging-area" style="max-height: 150px; overflow-y: auto;">
                            <Tag
                                v-for="stagedTag in stagedForBatchAdd"
                                :key="stagedTag.keyForList"
                                :item="mapStagedTagToDisplayItem(stagedTag)"
                                :remove="() => unstageTag(stagedTag)"
                            />
                        </div>

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
                                    :class="{'is-invalid': validateDraftTag.invalid && (validateDraftTag.messageKey === 'tagNameColorRequired' || validateDraftTag.messageKey === 'tagNameExists')}"
                                    :placeholder="$t('Name')"
                                    data-testid="tag-name-input"
                                    @keydown.enter.prevent="onEnter"
                                />
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
                                :class="{'is-invalid': validateDraftTag.invalid && validateDraftTag.messageKey === 'tagAlreadyOnMonitor'}"
                                :placeholder="$t('value (optional)')"
                                data-testid="tag-value-input"
                                @keydown.enter.prevent="onEnter"
                            />
                        </div>

                        <div v-if="validateDraftTag.invalid && validateDraftTag.messageKey" class="form-text text-danger mb-2">
                            {{ $t(validateDraftTag.messageKey, validateDraftTag.messageParams) }}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click.stop="clearStagingAndCloseModal">{{ $t("Cancel") }}</button>
                        <button type="button" class="btn btn-outline-primary me-2" :disabled="processing || validateDraftTag.invalid" @click.stop="stageCurrentTag">
                            {{ $t("Add Another Tag") }}
                        </button>
                        <button type="button" class="btn btn-primary" :disabled="processing || (stagedForBatchAdd.length === 0 && validateDraftTag.invalid)" data-testid="add-tags-final-button" @click.stop="confirmAndCommitStagedTags">{{ $t("Done") }}</button>
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
            /**
             * @type {Array<object>} Holds tag objects staged for addition.
             * Each object: { name, color, value, isNewSystemTag, systemTagId, keyForList }
             */
            stagedForBatchAdd: [],
            newDraftTag: {
                name: null,
                select: null,
                color: null,
                value: "",
            },
        };
    },
    computed: {
        tagOptions() {
            const tagOptions = [ ...this.existingTags ]; // Create a copy

            // Add tags from newTags
            for (const tag of this.newTags) {
                if (!tagOptions.find(t => t.name === tag.name && t.color === tag.color)) {
                    tagOptions.push(tag);
                }
            }

            // Add newly created system tags from staging area
            for (const stagedTag of this.stagedForBatchAdd) {
                if (stagedTag.isNewSystemTag) {
                    // Check if this system tag is already in the options
                    if (!tagOptions.find(t => t.name === stagedTag.name && t.color === stagedTag.color)) {
                        // Create a tag option object for the dropdown
                        tagOptions.push({
                            id: null, // Will be assigned when actually created
                            name: stagedTag.name,
                            color: stagedTag.color
                        });
                    }
                }
            }

            return tagOptions;
        },
        selectedTags() {
            // Helper function to normalize tag values for comparison
            const normalizeValue = (value) => {
                if (value === null || value === undefined) {
                    return "";
                }
                return String(value).trim();
            };

            // Helper function to get tag ID from different structures
            const getTagId = (tag) => tag.tag_id || tag.id;

            return this.preSelectedTags.concat(this.newTags).filter(tag =>
                !this.deleteTags.find(monitorTag => {
                    const tagIdMatch = getTagId(monitorTag) === getTagId(tag);
                    const valueMatch = normalizeValue(monitorTag.value) === normalizeValue(tag.value);
                    return tagIdMatch && valueMatch;
                })
            );
        },
        /**
         * @returns {boolean} True if more new system tags can be staged, false otherwise.
         */
        canStageMoreNewSystemTags() {
            return true; // Always allow adding more tags, no limit
        },
        /**
         * Provides the color options for the tag color selector.
         * @returns {Array<object>} Array of color options.
         */
        colorOptions() {
            return colorOptions(this);
        },
        /**
         * Validates the current draft tag based on several conditions.
         * @returns {{invalid: boolean, messageKey: string|null, messageParams: object|null}} Object indicating validity, and a message key/params if invalid.
         */
        validateDraftTag() {
            // If defining a new system tag (newDraftTag.select == null)
            if (this.newDraftTag.select == null) {
                if (!this.newDraftTag.name || this.newDraftTag.name.trim() === "" || !this.newDraftTag.color) {
                    // Keep button disabled, but don't show the explicit message for this case
                    return {
                        invalid: true,
                        messageKey: null,
                        messageParams: null,
                    };
                }
                if (this.tagOptions.find(opt => opt.name.toLowerCase() === this.newDraftTag.name.trim().toLowerCase())) {
                    return {
                        invalid: true,
                        messageKey: "tagNameExists",
                        messageParams: null,
                    };
                }
            }

            // For any tag definition (new or existing system tag + value)
            const draftTagName = this.newDraftTag.select ? this.newDraftTag.select.name : this.newDraftTag.name.trim();
            const draftTagValue = this.newDraftTag.value ? this.newDraftTag.value.trim() : ""; // Treat null/undefined value as empty string for comparison

            // Check if (name + value) combination already exists in this.stagedForBatchAdd
            if (this.stagedForBatchAdd.find(staged => staged.name === draftTagName && staged.value === draftTagValue)) {
                return {
                    invalid: true,
                    messageKey: "tagAlreadyStaged",
                    messageParams: null,
                };
            }

            // Check if (name + value) combination already exists in this.selectedTags (final list on monitor)
            // AND it's NOT an "undo delete"
            const isUndoDelete = this.deleteTags.find(dTag =>
                dTag.tag_id === (this.newDraftTag.select ? this.newDraftTag.select.id : null) &&
                dTag.value === draftTagValue
            );

            if (!isUndoDelete && this.selectedTags.find(sTag => sTag.name === draftTagName && sTag.value === draftTagValue)) {
                return {
                    invalid: true,
                    messageKey: "tagAlreadyOnMonitor",
                    messageParams: null,
                };
            }
            // If an existing tag is selected at this point, it has passed all relevant checks
            if (this.newDraftTag.select != null) {
                return {
                    invalid: false,
                    messageKey: null,
                    messageParams: null,
                };
            }

            // If it's a new tag definition, and it passed its specific checks, it's valid.
            // (This also serves as a final default to valid if other logic paths were missed, though ideally covered above)
            return {
                invalid: false,
                messageKey: null,
                messageParams: null,
            };
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
        this.getExistingTags();
    },
    beforeUnmount() {
        this.cleanupModal();
    },
    methods: {
        /**
         * Show the add tag dialog
         * @returns {void}
         */
        showAddDialog() {
            this.stagedForBatchAdd = [];
            this.clearDraftTag();
            this.getExistingTags();
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
         * Remove a draft tag
         * @returns {void}
         */
        clearDraftTag() {
            this.newDraftTag = {
                name: null,
                select: null,
                color: null,
                value: "",
                // invalid: true, // Initial validation will be handled by computed prop
            };
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
                this.stageCurrentTag();
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
        },
        /**
         * Clean up modal and restore scroll behavior
         * @returns {void}
         */
        cleanupModal() {
            if (this.modal) {
                try {
                    this.modal.hide();
                } catch (e) {
                    console.warn("Modal hide failed:", e);
                }
            }
            this.stagedForBatchAdd = [];
        },
        /**
         * Stages the current draft tag for batch addition.
         * @returns {void}
         */
        stageCurrentTag() {
            if (this.validateDraftTag.invalid) {
                return;
            }

            const isNew = this.newDraftTag.select == null;
            const name = isNew ? this.newDraftTag.name.trim() : this.newDraftTag.select.name;
            const color = isNew ? this.newDraftTag.color.color : this.newDraftTag.select.color;
            const value = this.newDraftTag.value ? this.newDraftTag.value.trim() : "";

            const stagedTagObject = {
                name: name,
                color: color,
                value: value,
                isNewSystemTag: isNew,
                systemTagId: isNew ? null : this.newDraftTag.select.id,
                keyForList: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 15)}` // Unique key
            };

            this.stagedForBatchAdd.push(stagedTagObject);
            this.clearDraftTag(); // Reset input fields for the next tag
        },
        /**
         * Removes a tag from the staged list.
         * @param {object} tagToUnstage The tag object to remove from staging.
         * @returns {void}
         */
        unstageTag(tagToUnstage) {
            this.stagedForBatchAdd = this.stagedForBatchAdd.filter(tag => tag.keyForList !== tagToUnstage.keyForList);
        },
        /**
         * Maps a staged tag object to the structure expected by the Tag component.
         * @param {object} stagedTag The staged tag object.
         * @returns {object} Object with name, color, value for the Tag component.
         */
        mapStagedTagToDisplayItem(stagedTag) {
            return {
                name: stagedTag.name,
                color: stagedTag.color,
                value: stagedTag.value,
                // id: stagedTag.keyForList, // Pass keyForList as id for the Tag component if it expects an id for display/keying internally beyond v-for key
            };
        },
        /**
         * Clears the staging list, draft inputs, and closes the modal.
         * @returns {void}
         */
        clearStagingAndCloseModal() {
            this.stagedForBatchAdd = [];
            this.clearDraftTag(); // Clears input fields
            this.modal.hide();
        },
        /**
         * Processes all staged tags, adds them to the monitor, and closes the modal.
         * @returns {void}
         */
        confirmAndCommitStagedTags() {
            // Phase 1: If there's a currently valid newDraftTag that hasn't been staged yet,
            // (e.g. user typed a full tag and directly clicked the footer "Add"), then stage it now.
            // stageCurrentTag has its own check for validateDraftTag.invalid and will clear the draft.
            if (!this.validateDraftTag.invalid) {
                // Check if newDraftTag actually has content, to avoid staging an empty cleared draft.
                // A valid draft implies it has content, but double-checking select or name is safer.
                if (this.newDraftTag.select || (this.newDraftTag.name && this.newDraftTag.color)) {
                    this.stageCurrentTag();
                }
            }

            // Phase 2: Process everything that is now in stagedForBatchAdd.
            if (this.stagedForBatchAdd.length === 0) {
                this.clearDraftTag(); // Ensure draft is clear even if nothing was committed
                this.modal.hide();
                return;
            }

            for (const sTag of this.stagedForBatchAdd) {
                let isAnUndo = false; // Flag to track if this was an undo
                // Check if it's an "undo delete"
                if (sTag.systemTagId) { // Only existing system tags can be an undo delete
                    const undoDeleteIndex = this.deleteTags.findIndex(
                        dTag => dTag.tag_id === sTag.systemTagId && dTag.value === sTag.value
                    );
                    if (undoDeleteIndex > -1) {
                        this.deleteTags.splice(undoDeleteIndex, 1);
                        isAnUndo = true;
                    }
                }

                // Only add to newTags if it's not an "undo delete" operation.
                // An "undo delete" means the tag is now considered active again from its previous state.
                if (!isAnUndo) {
                    const tagObjectForNewTags = {
                        id: sTag.systemTagId, // This will be null for brand new system tags
                        color: sTag.color,
                        name: sTag.name,
                        value: sTag.value,
                        new: true, // As per plan, signals new to this monitor transaction
                    };
                    this.newTags.push(tagObjectForNewTags);
                }
            }

            // newDraftTag should have been cleared if stageCurrentTag ran in Phase 1, or earlier.
            // Call clearDraftTag again to be certain the form is reset before closing.
            this.clearDraftTag();
            this.modal.hide();
        },
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
