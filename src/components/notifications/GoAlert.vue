<template>
    <div class="mb-3">
        <label for="goalert-base-url" class="form-label">{{ $t("Base URL") }}</label>
        <input id="goalert-base-url" v-model="$parent.notification.goAlertBaseURL" type="text" class="form-control" required>
        <i18n-t tag="div" keypath="goAlertInfo" class="form-text">
            <a href="https://goalert.me" target="_blank">https://goalert.me</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="goalert-token" class="form-label">{{ $t("Token") }}</label>
        <HiddenInput id="goalert-token" v-model="$parent.notification.goAlertToken" autocomplete="new-password" :required="true"></HiddenInput>

        <div class="form-text">
            {{ $t("goAlertIntegrationKeyInfo") }}
        </div>
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
