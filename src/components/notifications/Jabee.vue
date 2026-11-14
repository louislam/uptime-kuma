<template>
    <div class="mb-3">
        <label for="jabee-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput
            id="jabee-api-key"
            v-model="$parent.notification.jabeeApiKey"
            :required="true"
            autocomplete="new-password"
            placeholder="jak_..."
        ></HiddenInput>
        <i18n-t tag="div" keypath="jabeeApiKeyDescription" class="form-text">
            <a href="https://jabee.ai/docs/uptime-kuma/" target="_blank" rel="noopener">jabee.ai</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="jabee-base-url" class="form-label">{{ $t("Server URL") }}</label>
        <input
            id="jabee-base-url"
            v-model="$parent.notification.jabeeBaseURL"
            type="url"
            pattern="https?://.+"
            class="form-control"
            placeholder="https://api.jabee.ai"
        />
        <div class="form-text">{{ $t("jabeeBaseURLDescription") }}</div>
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
