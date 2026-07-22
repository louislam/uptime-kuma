<template>
    <div class="mb-3">
        <label for="plivo-auth-id" class="form-label">{{ $t("plivoAuthID") }}</label>
        <input
            id="plivo-auth-id"
            v-model="$parent.notification.plivoAuthID"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("plivoAuthIDHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="plivo-auth-token" class="form-label">{{ $t("plivoAuthToken") }}</label>
        <HiddenInput
            id="plivo-auth-token"
            v-model="$parent.notification.plivoAuthToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">{{ $t("plivoAuthTokenHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="plivo-from-number" class="form-label">{{ $t("plivoFromNumber") }}</label>
        <input
            id="plivo-from-number"
            v-model="$parent.notification.plivoFromNumber"
            type="text"
            class="form-control"
            placeholder="+15551234567"
            required
        />
        <div class="form-text">{{ $t("plivoFromNumberHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="plivo-to-number" class="form-label">{{ $t("plivoToNumber") }}</label>
        <input
            id="plivo-to-number"
            v-model="$parent.notification.plivoToNumber"
            type="text"
            class="form-control"
            placeholder="+15559876543"
            required
        />
        <div class="form-text">{{ $t("plivoToNumberHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="plivo-message-type" class="form-label">{{ $t("plivoMessageType") }}</label>
        <select id="plivo-message-type" v-model="$parent.notification.plivoMessageType" class="form-select">
            <option value="sms">SMS</option>
            <option value="call">{{ $t("plivoVoiceCall") }}</option>
        </select>
    </div>

    <div v-if="$parent.notification.plivoMessageType === 'call'" class="mb-3">
        <label for="plivo-answer-url" class="form-label">{{ $t("plivoAnswerUrl") }}</label>
        <input
            id="plivo-answer-url"
            v-model="$parent.notification.plivoAnswerUrl"
            type="url"
            class="form-control"
            placeholder="https://example.com/answer.xml"
            :required="true"
        />
        <div class="form-text">{{ $t("plivoAnswerUrlHelptext") }}</div>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
            <a
                v-if="$parent.notification.plivoMessageType === 'call'"
                href="https://www.plivo.com/docs/voice/api/call"
                target="_blank"
            >
                https://www.plivo.com/docs/voice/api/call
            </a>
            <a v-else href="https://www.plivo.com/docs/messaging/api/message" target="_blank">
                https://www.plivo.com/docs/messaging/api/message
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
    mounted() {
        if (typeof this.$parent.notification.plivoMessageType === "undefined") {
            this.$parent.notification.plivoMessageType = "sms";
        }
    },
};
</script>
