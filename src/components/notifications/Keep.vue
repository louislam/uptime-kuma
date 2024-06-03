<template>
    <div class="mb-3">
        <label for="webhook-url" class="form-label">{{ $t("Host URL") }}</label>
        <input
            id="webhook-url"
            v-model="$parent.notification.webhookURL"
            type="url"
            pattern="https?://.+"
            class="form-control"
            required
        />
        <div class="form-text">
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://docs.keephq.dev/providers/documentation/uptimekuma-provider" target="_blank">https://docs.keephq.dev/providers/documentation/uptimekuma-provider</a>
            </i18n-t>
        </div>
    </div>

    <div class="mb-3">
        <label for="webhook-apikey" class="form-label">{{
            $t("API Key")
        }}</label>
        <HiddenInput
            id="webhook-apikey"
            v-model="$parent.notification.webhookAPIKey"
            :required="true"
        ></HiddenInput>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        this.$parent.notification.webhookURL ||= "";
    },
};
</script>
