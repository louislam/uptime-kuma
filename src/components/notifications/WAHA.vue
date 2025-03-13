<template>
    <div class="mb-3">
        <label for="waha-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input id="waha-api-url" v-model="$parent.notification.wahaApiUrl" placeholder="http://localhost:3000/" type="url" class="form-control" required>
        <div class="form-text">{{ $t("wayToGetWahaApiUrl") }}</div>
    </div>

    <div class="mb-3">
        <label for="waha-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="waha-api-key" v-model="$parent.notification.wahaApiKey" :required="false" autocomplete="new-password"></HiddenInput>
        <div class="form-text">{{ $t("wayToGetWahaApiKey") }}</div>
    </div>

    <div class="mb-3">
        <label for="waha-session" class="form-label">{{ $t("wahaSession") }}</label>
        <input id="waha-session" v-model="$parent.notification.wahaSession" type="text" placeholder="default" class="form-control" required>
        <div class="form-text">{{ $t("wayToGetWahaSession") }}</div>
    </div>

    <div class="mb-3">
        <label for="waha-chat-id" class="form-label">{{ $t("wahaChatId") }}</label>
        <input id="waha-chat-id" v-model="$parent.notification.wahaChatId" type="text" pattern="^[\d-]{10,31}$" class="form-control" required>
        <div class="form-text">{{ $t("wayToWriteWahaChatId", ["00117612345678", "00117612345678@c.us", "123456789012345678@g.us"]) }}</div>
    </div>

    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https://waha.devlike.pro/" target="_blank">https://waha.devlike.pro/</a>
    </i18n-t>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    }
};
</script>
