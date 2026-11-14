<template>
    <div class="mb-3">
        <label for="trigv-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput
            id="trigv-api-key"
            v-model="$parent.notification.trigvApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="trigv-channel" class="form-label">{{ $t("Channel") }}</label>
        <input
            id="trigv-channel"
            v-model="$parent.notification.trigvChannel"
            type="text"
            class="form-control"
            maxlength="120"
            :placeholder="$t('trigvDefaultChannel')"
        />
        <div class="form-text">{{ $t("trigvChannelHelp") }}</div>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
        <a href="https://trigv.com/docs/learn/api-keys/" target="_blank">{{ $t("trigvApiKeyDocs") }}</a>
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
