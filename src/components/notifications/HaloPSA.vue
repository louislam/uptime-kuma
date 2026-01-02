<template>
    <div class="mb-3">
        <label for="halopsa-webhook-url" class="form-label">
            {{ $t("Halo PSA Webhook URL") }}
        </label>
        <HiddenInput
            v-model="$parent.notification.halowebhookurl"
            :maxlength="500"
            placeholder="https://your-instance.halopsa.com/api/v1/webhook"
        />
        <div class="form-text">
            {{ $t("halopsa_webhook_url_desc") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="halopsa-bearer-header" class="form-label">
            {{ $t("Bearer Header") }}
        </label>
        <input
            id="halopsa-bearer-header"
            v-model="$parent.notification.haloBearerHeader"
            :maxlength="500"
            autocomplete="off"
            :placeholder="$t('your-api-token-here')"
        />
        <div class="form-text">
            {{ $t("halopsa_bearer_header_desc") }}
        </div>
    </div>
</template>

<script>
/**
 * Halo PSA Notification Provider Vue Component
 */
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    }
};
</script>
