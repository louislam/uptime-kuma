<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Add New Status Page") }}
            </h1>

            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="mb-3">
                        <label for="name" class="form-label">{{ $t("Name") }}</label>
                        <input id="name" v-model="title" type="text" class="form-control" required data-testid="name-input">
                    </div>

                    <div class="mb-4">
                        <label for="slug" class="form-label">{{ $t("Slug") }}</label>
                        <div class="input-group">
                            <span id="basic-addon3" class="input-group-text">/status/</span>
                            <input id="slug" v-model="slug" type="text" class="form-control" autocapitalize="none" required data-testid="slug-input">
                        </div>
                        <div class="form-text">
                            <ul>
                                <li>{{ $t("Accept characters:") }} <mark>a-z</mark> <mark>0-9</mark> <mark>-</mark></li>
                                <li>{{ $t("No consecutive dashes") }} <mark>--</mark></li>
                                <i18n-t tag="li" keypath="statusPageSpecialSlugDesc">
                                    <mark class="me-1">default</mark>
                                </i18n-t>
                            </ul>
                        </div>
                    </div>

                    <div class="my-3 form-check">
                        <input id="dynamic" v-model="dynamic_status_page" type="checkbox" class="form-check-input" value="">
                        <label for="dynamic" class="form-check-label">
                            {{ $t("Dynamic Status Page") }}
                        </label>
                        <div class="form-text">
                            {{ $t("Dynamic status pages automatically include monitors with the selected tags") }}
                        </div>
                    </div>

                    <div v-if="dynamic_status_page" class="my-3">
                        <tags-manager
                            ref="tagsManager"
                            :pre-selected-tags="preSelectedTags"
                            @tags-updated="handleTagsUpdated"
                        ></tags-manager>
                    </div>

                    <div class="mt-2 mb-1">
                        <button
                            id="monitor-submit-btn"
                            class="btn btn-primary w-100"
                            type="submit"
                            :disabled="processing || (dynamic_status_page && selectedTags.length === 0)"
                            data-testid="submit-button"
                        >
                            <span v-if="processing">{{ $t("Creating...") }}</span>
                            <span v-else>{{ $t("Next") }}</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </transition>
</template>

<script>
import TagsManager from "../components/TagsManager.vue";

export default {
    components: {
        TagsManager,
    },
    data() {
        return {
            title: "",
            slug: "",
            dynamic_status_page: false,
            processing: false,
            preSelectedTags: [],
            selectedTags: [],
            tagsModified: false,
            tagsUpdateTimeout: null
        };
    },
    watch: {
        // Reset tags when dynamic status page is toggled off
        dynamic_status_page(newVal) {
            if (!newVal) {
                this.selectedTags = [];
                this.preSelectedTags = [];
                this.tagsModified = false;
            }
        },
        // Watch for tags changes to validate dynamic page
        selectedTags: {
            handler(newTags, oldTags) {
                // Only mark as modified if tags actually changed
                if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
                    this.tagsModified = true;
                }
            },
            deep: true
        }
    },
    methods: {
        /**
         * Handle tags updated from TagsManager
         * @param {Array} tags - Updated tags array
         * @returns {void}
         */
        handleTagsUpdated(tags) {
            console.log("🔄 Tags updated in parent, raw count:", tags.length);

            // Clear any existing timeout
            if (this.tagsUpdateTimeout) {
                clearTimeout(this.tagsUpdateTimeout);
            }

            // Debounce the update to prevent rapid successive updates
            this.tagsUpdateTimeout = setTimeout(() => {
                const uniqueTagsMap = new Map();

                tags.forEach(tag => {
                    if (!tag || !tag.name) {
                        return;
                    }

                    const key = `${tag.tag_id || tag.id || "new"}-${tag.name}-${tag.color}-${tag.value || ""}`;

                    if (!uniqueTagsMap.has(key)) {
                        uniqueTagsMap.set(key, { ...tag });
                    }
                });

                const uniqueTags = Array.from(uniqueTagsMap.values());

                // Only update if there's an actual change
                const currentTagsString = JSON.stringify(this.selectedTags);
                const newTagsString = JSON.stringify(uniqueTags);

                if (currentTagsString !== newTagsString) {
                    this.selectedTags = uniqueTags;
                    this.tagsModified = true;
                }

            }, 50); // 50ms debounce
        },
        /**
         * Get tags data in format suitable for API
         * @returns {Array} Formatted tags data
         */
        getFormattedTags() {
            const seenKeys = new Set();
            const uniqueTags = [];

            for (const tag of this.selectedTags) {
                const key = `${tag.tag_id || tag.id}-${tag.name}-${tag.color}-${tag.value || ""}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueTags.push({
                        tag_id: tag.tag_id || tag.id,
                        name: tag.name,
                        color: tag.color,
                        value: tag.value || ""
                    });
                }
            }

            return uniqueTags;
        },
        /**
         * Validate form data before submission
         * @returns {boolean} True if validation passes
         */
        validateForm() {
            if (!this.title.trim()) {
                this.$root.toastError(this.$t("Please enter a name for the status page"));
                return false;
            }

            if (!this.slug.trim()) {
                this.$root.toastError(this.$t("Please enter a slug for the status page"));
                return false;
            }

            // Slug validation
            const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
            if (!slugRegex.test(this.slug)) {
                this.$root.toastError(this.$t("Slug can only contain lowercase letters, numbers, and single dashes between words"));
                return false;
            }

            if (this.dynamic_status_page) {
                if (this.selectedTags.length === 0) {
                    this.$root.toastError(this.$t("Please select at least one tag for dynamic status page"));
                    return false;
                }

                const invalidTags = this.selectedTags.filter(tag => !tag.name || !tag.color);
                if (invalidTags.length > 0) {
                    this.$root.toastError(this.$t("Some tags are missing required information"));
                    return false;
                }
            }

            return true;
        },
        /**
         * Submit form data to add new status page
         * @returns {Promise<void>}
         */
        async submit() {
            // Validate form
            if (!this.validateForm()) {
                return;
            }

            this.processing = true;

            // Prepare tags data - only include tags if it's a dynamic page
            const tags = this.dynamic_status_page ? this.getFormattedTags() : [];

            this.$root.getSocket().emit("addStatusPage", this.title, this.slug, this.dynamic_status_page, tags, (res) => {
                this.processing = false;

                if (res.ok) {
                    location.href = "/status/" + res.slug + "?edit";
                } else {

                    if (res.msg.includes("UNIQUE constraint")) {
                        this.$root.toastError("The slug is already taken. Please choose another slug.");
                    } else {
                        this.$root.toastRes(res);
                    }
                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}

#slug {
    text-transform: lowercase;
}
</style>
