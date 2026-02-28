<template>
    <div class="mb-3">
        <label for="360messenger-auth-token" class="form-label">{{ $t("360messengerAuthToken") }}</label>
        <HiddenInput
            id="360messenger-auth-token"
            v-model="$parent.notification.Whatsapp360messengerAuthToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="360messengerWayToGetUrlAndToken" class="form-text">
            <a href="https://360messenger.com/en/uptime-kuma" target="_blank">
                https://360messenger.com/en/uptime-kuma
            </a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="360messenger-recipient" class="form-label">{{ $t("360messengerRecipient") }}</label>
        <input
            id="360messenger-recipient"
            v-model="$parent.notification.Whatsapp360messengerRecipient"
            type="text"
            class="form-control"
            placeholder="447488888888, 447499999999"
            :required="!hasAnySelectedGroup"
        />
        <div class="form-text">{{ $t("360messengerWayToWriteRecipient", ["447488888888"]) }}</div>
    </div>

    <!-- Checkbox to enable/disable Combobox -->
    <div class="mb-3 form-check form-switch">
        <input id="360messenger-enable-options" v-model="isOptionsEnabled" type="checkbox" class="form-check-input" />
        <label for="360messenger-enable-options" class="form-check-label">
            {{ $t("360messengerEnableSendToGroup") }}
        </label>
    </div>

    <!-- Group selection using existing VueMultiselect -->
    <div class="mb-3">
        <label for="360messenger-group-list" class="form-label">
            {{ $t("360messengerGroupList") }}
        </label>
        <VueMultiselect
            id="360messenger-group-list"
            v-model="$parent.notification.Whatsapp360messengerGroupIds"
            :options="groupOptions"
            :multiple="true"
            :close-on-select="false"
            :clear-on-select="false"
            :preserve-search="true"
            :placeholder="$t('360messengerSelectGroupList')"
            :preselect-first="false"
            :max-height="400"
            :taggable="false"
            :disabled="!isOptionsEnabled || isLoadingGroups"
            label="label"
            track-by="id"
        >
            <template #noOptions>
                <div class="multiselect__option">
                    <span v-if="isLoadingGroups">{{ $t("Loading...") }}</span>
                    <span v-else>{{ $t("360messengerErrorNoGroups") }}</span>
                </div>
            </template>
        </VueMultiselect>
        <div v-if="errorMessage" class="text-danger mt-1">{{ errorMessage }}</div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                v-model="$parent.notification.Whatsapp360messengerUseTemplate"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label">{{ $t("360messengerCustomMessageTemplate") }}</label>
        </div>

        <div class="form-text">
            {{ $t("360messengerEnableCustomMessage") }}
        </div>
    </div>

    <template v-if="$parent.notification.Whatsapp360messengerUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="360messenger-template">{{ $t("360messengerMessageTemplate") }}</label>
            <TemplatedTextarea
                id="360messenger-template"
                v-model="$parent.notification.Whatsapp360messengerTemplate"
                :required="true"
                :placeholder="Whatsapp360messengerTemplatedTextareaPlaceholder"
            ></TemplatedTextarea>
        </div>
    </template>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";
import VueMultiselect from "vue-multiselect";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
        VueMultiselect,
    },
    data() {
        return {
            isOptionsEnabled: false,
            groups: [],
            isLoadingGroups: false,
            errorMessage: "",
        };
    },
    computed: {
        Whatsapp360messengerTemplatedTextareaPlaceholder() {
            return this.$t("Example:", [
                `
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}

{{ msg }}
                `,
            ]);
        },
        groupOptions() {
            return this.groups.map((g) => ({
                id: g.id,
                label: `${g.id} - ${g.name}`,
            }));
        },
        selectedGroupIds() {
            const raw =
                this.$parent.notification.Whatsapp360messengerGroupIds ||
                this.$parent.notification.Whatsapp360messengerGroupId;

            if (Array.isArray(raw)) {
                return raw
                    .map((item) => {
                        if (typeof item === "string") {
                            return item.trim();
                        }
                        if (item && typeof item === "object" && item.id) {
                            return String(item.id).trim();
                        }
                        return "";
                    })
                    .filter((id) => id !== "");
            }

            if (typeof raw === "string" && raw.trim() !== "") {
                return raw
                    .split(/[;,]/)
                    .map((id) => id.trim())
                    .filter((id) => id !== "");
            }

            return [];
        },
        hasAnySelectedGroup() {
            return this.selectedGroupIds.length > 0;
        },
    },
    watch: {
        // When checkbox is enabled, fetch groups from API
        isOptionsEnabled(newValue, oldValue) {
            if (newValue) {
                this.fetchGroups();
            } else if (oldValue && !this.errorMessage) {
                // Only clear if user manually unchecked (not due to error)
                this.$parent.notification.Whatsapp360messengerGroupIds = [];
                this.$parent.notification.Whatsapp360messengerGroupId = "";
                this.groups = [];
            }
        },
        "$parent.notification.Whatsapp360messengerGroupIds": {
            immediate: true,
            handler(value) {
                if (Array.isArray(value)) {
                    return;
                }

                let source = value;

                if (!source && this.$parent.notification.Whatsapp360messengerGroupId) {
                    source = this.$parent.notification.Whatsapp360messengerGroupId;
                }

                let normalized = [];

                if (typeof source === "string" && source.trim() !== "") {
                    normalized = source
                        .split(/[;,]/)
                        .map((v) => v.trim())
                        .filter((v) => v !== "");
                }

                this.$parent.notification.Whatsapp360messengerGroupIds = normalized;
            },
        },
    },
    methods: {
        toggleDropdown() {
            if (!this.isOptionsEnabled || this.isLoadingGroups) {
                return;
            }
            this.isDropdownOpen = !this.isDropdownOpen;
        },
        toggleGroupId(id) {
            const trimmed = typeof id === "string" ? id.trim() : "";
            if (!trimmed) {
                return;
            }

            if (this.selectedGroupIds.includes(trimmed)) {
                this.removeGroupId(trimmed);
            } else {
                this.addGroupId(trimmed);
            }
        },
        addGroupId(id) {
            const trimmed = typeof id === "string" ? id.trim() : "";
            if (!trimmed) {
                return;
            }

            const list = this.$parent.notification.Whatsapp360messengerGroupIds;
            if (!Array.isArray(list)) {
                return;
            }

            // Prefer the new array-based field going forward
            this.$parent.notification.Whatsapp360messengerGroupId = "";

            if (!list.includes(trimmed)) {
                list.push(trimmed);
            }
        },
        removeGroupId(id) {
            const list = this.$parent.notification.Whatsapp360messengerGroupIds;
            if (!Array.isArray(list)) {
                return;
            }

            this.$parent.notification.Whatsapp360messengerGroupIds = list.filter((x) => x !== id);
        },
        async fetchGroups() {
            this.isLoadingGroups = true;
            this.errorMessage = "";

            try {
                const token = this.$parent.notification.Whatsapp360messengerAuthToken;

                if (!token) {
                    this.errorMessage = this.$t("360messengerErrorNoApiKey");
                    this.isLoadingGroups = false;
                    this.isOptionsEnabled = false;
                    return;
                }

                const response = await fetch("https://api.360messenger.com/v2/groupChat/getGroupList", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                const result = await response.json();

                if (result.success && result.data && result.data.groups) {
                    this.groups = result.data.groups;
                    if (this.groups.length === 0) {
                        this.errorMessage = this.$t("360messengerErrorNoGroups");
                        this.isOptionsEnabled = false;
                    }
                } else {
                    // Handle API error response
                    const statusCode = result.statusCode || response.status;
                    const message = result.message || "Failed to load groups";
                    this.errorMessage = this.$t("360messengerErrorApi", { statusCode, message });
                    this.isOptionsEnabled = false;
                }
            } catch (error) {
                this.errorMessage = this.$t("360messengerErrorGeneric", { message: error.message });
                this.isOptionsEnabled = false;
                console.error("Error fetching groups:", error);
            } finally {
                this.isLoadingGroups = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 150px;
}
</style>
