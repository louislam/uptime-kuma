<template>
    <div class="mb-3">
        <label for="pinglet-publish-url" class="form-label">
            {{ $t("Pinglet Topic URL") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="pinglet-publish-url"
            v-model="$parent.notification.pingletPublishUrl"
            type="url"
            class="form-control"
            required
            autocomplete="false"
            placeholder="https://app.pinglet.co.uk/your-namespace/alerts"
        />
        <div class="form-text">
            {{ $t("pingletTopicUrlDescription") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="pinglet-api-key" class="form-label">
            {{ $t("API Key") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <HiddenInput
            id="pinglet-api-key"
            v-model="$parent.notification.pingletApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
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
