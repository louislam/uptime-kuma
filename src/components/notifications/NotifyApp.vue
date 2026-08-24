<template>
    <div class="mb-3">
        <label for="notifyapp-device-id" class="form-label">{{ $t("Device ID or Group ID") }}</label>
        <input
            id="notifyapp-device-id"
            v-model="$parent.notification.notifyAppDeviceId"
            type="text"
            class="form-control"
            required
            placeholder="ABC12345"
        />
        <div class="form-text">
            {{ $t("notifyAppDeviceIdDescription") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="notifyapp-token" class="form-label">{{ $t("Token") }}</label>
        <HiddenInput
            id="notifyapp-token"
            v-model="$parent.notification.notifyAppToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="notifyapp-icon-url" class="form-label">{{ $t("Icon URL") }}</label>
        <input
            id="notifyapp-icon-url"
            v-model="$parent.notification.notifyAppIconUrl"
            type="text"
            class="form-control"
        />
    </div>
    <div class="mb-3">
        <i18n-t tag="p" keypath="notifyAppSetup" class="form-text">
            <a href="https://getnotifyapp.com" target="_blank" rel="noopener">getnotifyapp.com</a>
        </i18n-t>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
