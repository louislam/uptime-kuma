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
        <label for="halopsa-auth-header" class="form-label">
            {{ $t("Authentication Header") }} ({{ $t("Optional") }})
        </label>
        <input
            id="halopsa-auth-header"
            v-model="$parent.notification.haloAuthHeader"
            type="text"
            class="form-control"
            placeholder="{'Authentication': 'Bearer your-token-here'}"
        />
        <div class="form-text">
            {{ $t("halopsa_auth_header_desc") }}
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
    },
    mounted() {
        // initialize default value if not set
        if (typeof this.$parent.notification.halowebhookurl === "undefined") {
            this.$parent.notification.halowebhookurl = "";
        }

        if (typeof this.$parent.notification.haloAuthHeader === "undefined") {
            this.$parent.notification.haloAuthHeader = "";
        }
    }
};
</script>
