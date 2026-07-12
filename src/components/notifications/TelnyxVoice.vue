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
        <div class="form-check form-switch">
            <input v-model="$parent.notification.telnyxVoiceUseTemplate" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("telnyxVoiceUseTemplate") }}</label>
        </div>

        <div class="form-text">
            {{ $t("telnyxVoiceUseTemplateDescription") }}
        </div>
    </div>

    <template v-if="$parent.notification.telnyxVoiceUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="telnyxv-text">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="telnyxv-text"
                v-model="$parent.notification.telnyxVoiceText"
                :required="true"
                :placeholder="telnyxVoiceTemplatedTextareaPlaceholder"
            ></TemplatedTextarea>
        </div>
    </template>

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
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
    },
    computed: {
        /**
         * Placeholder text for the templated textarea
         * @returns {string} Placeholder text
         */
        telnyxVoiceTemplatedTextareaPlaceholder() {
            return this.$t("Example:", [
                `
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}

{{ msg }}
                `,
            ]);
        },
    },
};
</script>
