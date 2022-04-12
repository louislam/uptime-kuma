<template>
    <div class="mb-3">
        <label for="push-api-key" class="form-label">API_KEY</label>
        <HiddenInput id="push-api-key" v-model="$parent.notification.pushAPIKey" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.push.techulus.com" target="_blank">https://docs.push.techulus.com</a>
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
