<template>
    <div class="group-log-panel" data-testid="group-log-panel">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="group-log-title mb-0">{{ $t("Maintenance and Incident Log") }}</h2>
            <button
                v-if="editMode && !showForm"
                class="btn btn-outline-primary btn-sm"
                data-testid="group-log-add-button"
                @click="startAdd"
            >
                <font-awesome-icon icon="plus" />
                {{ $t("Add") }}
            </button>
        </div>

        <!-- Add / Edit form -->
        <div v-if="showForm" class="shadow-box p-3 mb-3" data-testid="group-log-form">
            <div class="mb-2">
                <div class="btn-group btn-group-sm" role="group">
                    <button
                        type="button"
                        class="btn"
                        :class="formData.type === 'maintenance' ? 'btn-primary' : 'btn-outline-primary'"
                        @click="formData.type = 'maintenance'"
                    >
                        <font-awesome-icon icon="wrench" />
                        {{ $t("Maintenance") }}
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="formData.type === 'incident' ? 'btn-primary' : 'btn-outline-primary'"
                        @click="formData.type = 'incident'"
                    >
                        <font-awesome-icon icon="bullhorn" />
                        {{ $t("Incident") }}
                    </button>
                </div>
            </div>

            <strong>{{ $t("Title") }}:</strong>
            <Editable
                :model-value="formData.title"
                tag="h5"
                :contenteditable="true"
                :noNL="true"
                class="mb-2"
                data-testid="group-log-title-input"
                @update:model-value="formData.title = $event"
            />

            <strong>{{ $t("Content") }}:</strong>
            <Editable
                :model-value="formData.content"
                tag="div"
                :contenteditable="true"
                class="group-log-content-editable"
                data-testid="group-log-content-input"
                @update:model-value="formData.content = $event"
            />
            <div class="form-text">{{ $t("markdownSupported") }}</div>

            <div v-if="formError" class="text-danger small mt-2">{{ formError }}</div>

            <div class="mt-3">
                <button class="btn btn-primary btn-sm me-2" data-testid="group-log-save-button" @click="save">
                    <font-awesome-icon icon="save" />
                    {{ $t("Save") }}
                </button>
                <button class="btn btn-light btn-sm" @click="cancelForm">
                    <font-awesome-icon icon="times" />
                    {{ $t("Cancel") }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">{{ $t("Loading...") }}</span>
            </div>
        </div>

        <div v-else-if="entries.length === 0 && !showForm" class="text-muted small" data-testid="group-log-empty">
            {{ $t("No log entries yet") }}
        </div>

        <div v-else class="group-log-list">
            <div v-for="entry in entries" :key="entry.id" class="group-log-item" data-testid="group-log-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge" :class="entry.type === 'maintenance' ? 'bg-warning' : 'bg-info'">
                            <font-awesome-icon :icon="entry.type === 'maintenance' ? 'wrench' : 'bullhorn'" />
                            {{ entry.type === "maintenance" ? $t("Maintenance") : $t("Incident") }}
                        </span>
                        <h5 class="group-log-item-title mb-0">{{ entry.title }}</h5>
                    </div>
                    <div v-if="editMode" class="group-log-item-actions">
                        <button
                            class="btn btn-outline-secondary btn-sm me-1"
                            :title="$t('Edit')"
                            data-testid="group-log-edit-button"
                            @click="startEdit(entry)"
                        >
                            <font-awesome-icon icon="pen" />
                        </button>
                        <button
                            class="btn btn-outline-danger btn-sm"
                            :title="$t('Delete')"
                            data-testid="group-log-delete-button"
                            @click="remove(entry)"
                        >
                            <font-awesome-icon icon="trash" />
                        </button>
                    </div>
                </div>
                <!-- eslint-disable-next-line vue/no-v-html-->
                <div class="group-log-content mt-1" v-html="renderContent(entry.content)"></div>
                <div class="text-muted small mt-1">
                    {{ $t("createdAt", { date: datetime(entry.createdDate) }) }}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import datetimeMixin from "../mixins/datetime";

const emptyForm = () => ({ id: null, type: "maintenance", title: "", content: "" });

export default {
    mixins: [datetimeMixin],
    props: {
        /** Id of the group whose log is shown */
        groupId: {
            type: [String, Number],
            required: true,
        },
        /** Whether admin add/edit/delete controls are shown */
        editMode: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            entries: [],
            loading: false,
            showForm: false,
            isEditing: false,
            formData: emptyForm(),
            formError: "",
        };
    },
    watch: {
        groupId() {
            this.showForm = false;
            this.load();
        },
    },
    mounted() {
        this.load();
    },
    methods: {
        /**
         * (Re)load the group's log entries from the public REST endpoint
         * @returns {Promise<void>}
         */
        async load() {
            this.loading = true;
            try {
                const res = await axios.get(`/api/status-page/group/${this.groupId}/log`);
                this.entries = res.data?.entries ?? [];
            } catch (error) {
                this.entries = [];
            } finally {
                this.loading = false;
            }
        },

        /**
         * Render sanitized HTML for a log entry's markdown content
         * @param {string} content Markdown content
         * @returns {string} Sanitized HTML
         */
        renderContent(content) {
            if (content == null) {
                return "";
            }
            return DOMPurify.sanitize(marked(content));
        },

        /**
         * Open the form to add a new entry
         * @returns {void}
         */
        startAdd() {
            this.formData = emptyForm();
            this.isEditing = false;
            this.formError = "";
            this.showForm = true;
        },

        /**
         * Open the form to edit an existing entry
         * @param {object} entry Entry to edit
         * @returns {void}
         */
        startEdit(entry) {
            this.formData = { id: entry.id, type: entry.type, title: entry.title, content: entry.content };
            this.isEditing = true;
            this.formError = "";
            this.showForm = true;
        },

        /**
         * Close the add/edit form without saving
         * @returns {void}
         */
        cancelForm() {
            this.showForm = false;
            this.formError = "";
        },

        /**
         * Save the current add/edit form
         * @returns {void}
         */
        save() {
            this.formError = "";

            const payload = {
                type: this.formData.type,
                title: this.formData.title,
                content: this.formData.content,
            };

            const event = this.isEditing ? "editGroupLogEntry" : "addGroupLogEntry";
            const args = this.isEditing
                ? [ this.groupId, this.formData.id, payload ]
                : [ this.groupId, payload ];

            this.$root.getSocket().emit(event, ...args, (res) => {
                if (res.ok) {
                    this.showForm = false;
                    this.load();
                } else {
                    this.formError = res.msg;
                }
            });
        },

        /**
         * Delete a log entry
         * @param {object} entry Entry to delete
         * @returns {void}
         */
        remove(entry) {
            this.$root.getSocket().emit("deleteGroupLogEntry", this.groupId, entry.id, (res) => {
                if (res.ok) {
                    this.load();
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.group-log-title {
    font-size: 1.1rem;
}

.group-log-content-editable {
    min-height: 60px;
}

.group-log-item {
    padding: 0.75rem 0;

    & + .group-log-item {
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }
}

.dark .group-log-item + .group-log-item {
    border-top-color: rgba(255, 255, 255, 0.08);
}

.group-log-item-title {
    font-size: 1rem;
}
</style>
