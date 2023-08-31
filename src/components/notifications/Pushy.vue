<template>
    <div class="mb-3">
        <label for="pushy-app-token" class="form-label">{{ $t("pushyAPIKey") }}</label>
        <HiddenInput id="pushy-app-token" v-model="$parent.notification.pushyAPIKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="pushy-user-key" class="form-label">{{ $t("pushyToken") }}</label>
        <HiddenInput id="pushy-user-key" v-model="$parent.notification.pushyToken" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://pushy.me/docs/api/send-notifications" target="_blank">https://pushy.me/docs/api/send-notifications</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
