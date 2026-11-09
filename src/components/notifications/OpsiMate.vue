<template>
    <div class="mb-3">
        <label for="opsimate-url" class="form-label">{{ $t("OpsiMate URL") }}</label>
        <input
            id="opsimate-url"
            v-model="$parent.notification.opsimateURL"
            type="url"
            pattern="https?://.+"
            class="form-control"
            required
            placeholder="https://opsimate.example.com:3001"
        />
        <div class="form-text">
            <p>{{ $t("opsimateUrlDescription") }}</p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://docs.opsimate.dev/docs/integrations/uptime-kuma" target="_blank">
                    https://docs.opsimate.dev/docs/integrations/uptime-kuma
                </a>
            </i18n-t>
        </div>
    </div>

    <div class="mb-3">
        <label for="opsimate-api-token" class="form-label">{{ $t("API Token") }}</label>
        <HiddenInput
            id="opsimate-api-token"
            v-model="$parent.notification.opsimateAPIToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">
            {{ $t("opsimateApiTokenDescription") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        this.$parent.notification.opsimateURL ||= "";
    },
};
</script>
