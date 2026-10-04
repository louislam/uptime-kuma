<template>
    <div class="mb-3">
        <label for="smsgateway-url" class="form-label">{{ $t("Server URL") }}</label>
        <input
            id="smsgateway-url"
            v-model="$parent.notification.smsgatewayUrl"
            type="url"
            class="form-control"
            placeholder="http://localhost:8080"
            required
        />
        <div class="form-text">{{ $t("smsgatewayUrlHelptext") }}</div>
    </div>
    <div class="mb-3">
        <label for="smsgateway-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput
            id="smsgateway-api-key"
            v-model="$parent.notification.smsgatewayApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="smsgateway-to" class="form-label">{{ $t("smsgatewayTo") }}</label>
        <input
            id="smsgateway-to"
            v-model="$parent.notification.smsgatewayTo"
            type="text"
            class="form-control"
            placeholder="+15551234567, +15559876543"
            required
        />
        <div class="form-text">{{ $t("smsgatewayToHelptext") }}</div>
    </div>
    <i18n-t tag="div" keypath="Read more:" class="form-text">
        <a href="https://github.com/mattboston/sms-gateway" target="_blank">
            https://github.com/mattboston/sms-gateway
        </a>
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
