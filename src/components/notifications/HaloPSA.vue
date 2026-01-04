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
        <label for="halopsa-username" class="form-label">
            {{ $t("Username") }}
        </label>
        <input
            id="halopsa-username"
            v-model="$parent.notification.haloUsername"
            type="text"
            class="form-control"
            autocomplete="off"
            :placeholder="$t('Username')"
        />
        <div class="form-text">
            {{ $t("halopsa_username_desc") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="halopsa-password" class="form-label">
            {{ $t("Password") }}
        </label>
        <input
            id="halopsa-password"
            v-model="$parent.notification.haloPassword"
            type="text"
            class="form-control"
            :maxlength="500"
            autocomplete="off"
            :placeholder="$t('Password')"
        />
        <div class="form-text">
            {{ $t("halopsa_password_desc") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    }
};
</script>
