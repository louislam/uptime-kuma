<template>
    <div class="mb-3">
        <label for="google-chat-webhook-url" class="form-label">{{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="google-chat-webhook-url" v-model="$parent.notification.googleChatWebhookURL" type="text" class="form-control" required>

        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px;">
                <a href="https://developers.google.com/chat/how-tos/webhooks" target="_blank">https://developers.google.com/chat/how-tos/webhooks</a>
            </i18n-t>
        </div>
    </div>

    <div class="mb-3">
        <label for="google-chat-max-retries" class="form-label">{{ $t("Maximum Retries") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="google-chat-max-retries" v-model.number="$parent.notification.googleChatMaxRetries" type="number" class="form-control" min="1" max="10" step="1" required>
        <div class="form-text">
            {{ $t("Number of retry attempts if webhook fails") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input id="google-chat-use-template" v-model="$parent.notification.googleChatUseTemplate" type="checkbox" class="form-check-input">
            <label for="google-chat-use-template" class="form-check-label"> {{ $t("Template plain text instead of using cards") }} </label>
            <i18n-t tag="p" class="form-text" keypath="issueWithGoogleChatOnAndroidHelptext">
                <template #issuetackerURL>
                    <a href="https://issuetracker.google.com/issues/283746283" target="_blank">issuetracker.google.com/issues/283746283</a>
                </template>
            </i18n-t>
        </div>
    </div>

    <template v-if="$parent.notification.googleChatUseTemplate">
        <div class="mb-3">
            <TemplatedTextarea id="google-chat-template" v-model="$parent.notification.googleChatTemplate" :required="true" :placeholder="googleChatTemplatePlaceholder" />
        </div>
    </template>
</template>

<script>
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    name: "GoogleChat",
    components: {
        TemplatedTextarea,
    },
    computed: {
        googleChatTemplatePlaceholder() {
            return this.$t("Example:", [
                "{{ name }} - {{ msg }}{% if hostnameOrURL %} ({{ hostnameOrURL }}){% endif %}"
            ]);
        }
    },
    mounted() {
        // Initialize default if needed
        if (!this.$parent.notification.googleChatMaxRetries) {
            this.$parent.notification.googleChatMaxRetries ||= 1;
        }
    },
};
</script>
