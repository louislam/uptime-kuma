<template>
    <div class="mb-3">
        <label for="clickup-token" class="form-label">
            {{ $t("ClickUp API Token") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <HiddenInput
            id="clickup-token"
            v-model="$parent.notification.clickupToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">
            {{ $t("ClickUp API Token Description") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="clickup-workspace-id" class="form-label">
            {{ $t("ClickUp Workspace ID") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="clickup-workspace-id"
            v-model="$parent.notification.clickupWorkspaceId"
            type="text"
            class="form-control"
            required
            autocomplete="off"
        />
        <div class="form-text">
            {{ $t("ClickUp Workspace ID Description") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="clickup-channel-id" class="form-label">
            {{ $t("ClickUp Channel ID") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="clickup-channel-id"
            v-model="$parent.notification.clickupChannelId"
            type="text"
            class="form-control"
            required
            autocomplete="off"
        />
        <div class="form-text">
            {{ $t("ClickUp Channel ID Description") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="clickup-disable-url"
                v-model="$parent.notification.clickupDisableUrl"
                type="checkbox"
                class="form-check-input"
            />
            <label for="clickup-disable-url" class="form-check-label">
                {{ $t("Disable URL in Notification") }}
            </label>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    },
    mounted() {},
};
</script>
