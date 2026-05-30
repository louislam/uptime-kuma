<template>
    <div class="mb-3">
        <label for="clickup-token" class="form-label">
            {{ $t("Clickup API Token") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="clickup-token"
            v-model="$parent.notification.clickupToken"
            type="password"
            class="form-control"
            required
            autocomplete="off"
        />
        <div class="form-text">
            {{ $t("Clickup API Token Description") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="clickup-channel-id" class="form-label">
            {{ $t("Clickup Channel ID") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="clickup-channel-id"
            v-model="$parent.notification.clickupChannelId"
            type="text"
            class="form-control"
            required
            autocomplete="false"
        />
        <div class="form-text">
            {{ $t("Clickup Channel ID Description") }}
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
export default {
    name: "Clickup",
};
</script>
