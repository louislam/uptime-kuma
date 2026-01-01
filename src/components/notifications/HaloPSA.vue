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
        <div class="form-check">
            <input
                id="halopsa-apply-existing"
                v-model="$parent.notification.apply_existing"
                type="checkbox"
                class="form-check-input"
            />
            <label class="form-check-label" for="halopsa-apply-existing">
                {{ $t("Apply on all existing monitors") }}
            </label>
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
        //initialize default value if not set
        if (typeof this.$parent.notification.halowebhookurl === "undefined") {
            this.$parent.notification.halowebhookurl = "";
        }
        //initialize apply_existing filed
        if (typeof this.$parent.notification.apply_existing === "undefined") {
            this.$parent.notification.apply_existing = false;
        }
    }
};
</script>
