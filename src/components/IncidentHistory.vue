<template>
    <div class="incident-group" data-testid="incident-group">
        <div v-if="loading && incidents.length === 0" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">{{ $t("Loading...") }}</span>
            </div>
        </div>

        <div v-else-if="incidents.length === 0" class="text-center py-4 text-muted">
            {{ $t("No incidents recorded") }}
        </div>

        <div v-else class="incident-list">
            <div
                v-for="incident in incidents"
                :key="incident.id"
                class="incident-item"
                :class="{ resolved: !incident.active }"
            >
                <div class="incident-style-indicator" :class="`bg-${incident.style}`"></div>
                <div class="incident-body">
                    <div class="incident-header d-flex justify-content-between align-items-start">
                        <h5 class="incident-title mb-0">{{ incident.title }}</h5>
                        <div v-if="editMode" class="incident-actions">
                            <button
                                v-if="incident.active"
                                class="btn btn-success btn-sm me-1"
                                :title="$t('Resolve')"
                                @click="$emit('resolve-incident', incident)"
                            >
                                <font-awesome-icon icon="check" />
                            </button>
                            <button
                                class="btn btn-outline-secondary btn-sm me-1"
                                :title="$t('Edit')"
                                @click="$emit('edit-incident', incident)"
                            >
                                <font-awesome-icon icon="edit" />
                            </button>
                            <button
                                class="btn btn-outline-danger btn-sm"
                                :title="$t('Delete')"
                                @click="$emit('delete-incident', incident)"
                            >
                                <font-awesome-icon icon="trash" />
                            </button>
                        </div>
                    </div>
                    <!-- eslint-disable-next-line vue/no-v-html-->
                    <div class="incident-content mt-1" v-html="getIncidentHTML(incident.content)"></div>
                    <div class="incident-meta text-muted small mt-2">
                        <div>{{ $t("createdAt", { date: datetime(incident.createdDate) }) }}</div>
                        <div v-if="incident.lastUpdatedDate">
                            {{ $t("lastUpdatedAt", { date: datetime(incident.lastUpdatedDate) }) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { marked } from "marked";
import DOMPurify from "dompurify";
import datetimeMixin from "../mixins/datetime";

export default {
    name: "IncidentHistory",
    mixins: [datetimeMixin],
    props: {
        incidents: {
            type: Array,
            default: () => [],
        },
        editMode: {
            type: Boolean,
            default: false,
        },
        loading: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["edit-incident", "delete-incident", "resolve-incident"],
    methods: {
        /**
         * Get sanitized HTML for incident content
         * @param {string} content - Markdown content
         * @returns {string} Sanitized HTML
         */
        getIncidentHTML(content) {
            if (content != null) {
                return DOMPurify.sanitize(marked(content));
            }
            return "";
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.incident-group {
    padding: 10px;

    .incident-list {
        .incident-item {
            display: flex;
            padding: 13px 15px 10px 15px;
            border-radius: 10px;
            transition: all ease-in-out 0.15s;

            &:hover {
                background-color: $highlight-white;
            }

            &.resolved {
                opacity: 0.7;
            }

            .incident-style-indicator {
                width: 6px;
                min-height: 100%;
                border-radius: 3px;
                flex-shrink: 0;
                margin-right: 12px;
            }

            .incident-body {
                flex: 1;
                min-width: 0;
            }

            .incident-meta {
                font-size: 12px;
            }
        }
    }
}

.dark {
    .incident-group {
        .incident-list {
            .incident-item {
                &:hover {
                    background-color: $dark-bg2;
                }
            }
        }
    }
}
</style>
