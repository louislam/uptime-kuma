<template>
    <div class="mb-3">
        <label for="telnyxv-api-key" class="form-label">{{ $t("telnyxApiKey") }}</label>
        <HiddenInput
            id="telnyxv-api-key"
            v-model="$parent.notification.telnyxApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">{{ $t("telnyxApiKeyHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyxv-app-id" class="form-label">{{ $t("telnyxVoiceAppId") }}</label>
        <input
            id="telnyxv-app-id"
            v-model="$parent.notification.telnyxVoiceAppId"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("telnyxVoiceAppIdHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyxv-phone-number" class="form-label">{{ $t("telnyxPhoneNumber") }}</label>
        <input
            id="telnyxv-phone-number"
            v-model="$parent.notification.telnyxPhoneNumber"
            type="text"
            class="form-control"
            placeholder="+15551234567"
            required
        />
        <div class="form-text">{{ $t("telnyxPhoneNumberHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyxv-to-number" class="form-label">{{ $t("telnyxToNumber") }}</label>
        <input
            id="telnyxv-to-number"
            v-model="$parent.notification.telnyxToNumber"
            type="text"
            class="form-control"
            placeholder="+15559876543"
            required
        />
        <div class="form-text">{{ $t("telnyxToNumberHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyxv-base-url" class="form-label">{{ $t("telnyxVoiceBaseUrl") }}</label>
        <input
            id="telnyxv-base-url"
            v-model="$parent.notification.telnyxVoiceBaseUrl"
            type="url"
            class="form-control"
            placeholder="https://your-uptime-kuma-instance.example.com"
            required
        />
        <div class="form-text">{{ $t("telnyxVoiceBaseUrlHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyxv-text" class="form-label">{{ $t("telnyxVoiceText") }}</label>
        <textarea
            id="telnyxv-text"
            v-model="$parent.notification.telnyxVoiceText"
            class="form-control"
            rows="3"
            :placeholder="$t('telnyxVoiceTextPlaceholder', { kumaMessage: '{kumaMessage}' })"
        ></textarea>
        <i18n-t keypath="telnyxVoiceTextHelptext" tag="div" class="form-text">
            <template #kumaMessage><code>{kumaMessage}</code></template>
        </i18n-t>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
            <a href="https://developers.telnyx.com/docs/voice/call-control/quickstart" target="_blank">
                https://developers.telnyx.com/docs/voice/call-control
            </a>
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
