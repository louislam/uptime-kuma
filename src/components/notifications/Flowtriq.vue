<template>
    <div class="mb-3">
        <label for="flowtriq-webhook-url" class="form-label">
            {{ $t("Flowtriq Webhook URL") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="flowtriq-webhook-url"
            v-model="$parent.notification.flowtriqWebhookUrl"
            type="url"
            class="form-control"
            required
            autocomplete="false"
            placeholder="https://app.flowtriq.com/api/webhooks/..."
        />
    </div>
    <div class="mb-3">
        <label for="flowtriq-api-key" class="form-label">
            {{ $t("Flowtriq API Key") }}
        </label>
        <HiddenInput
            id="flowtriq-api-key"
            v-model="$parent.notification.flowtriqApiKey"
            autocomplete="false"
            :placeholder="$t('Optional')"
        />
        <div class="form-text">
            {{ $t("flowtriqApiKeyDescription") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    },
    mounted() {},
};
</script>
