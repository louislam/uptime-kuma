<template>
    <div class="mb-3">
        <label for="halopsa-webhook-url" class="form-label">
            {{ $t("Halo PSA Webhook URL") }}
            <span class="test-danger">*</span>
        </label>
        <HiddenInput
            v-model="$parent.notification.halowebhookurl"
            :maxlength="500"
            placeholder="https://your-instance.halopsa.com/api/v1/webhook"
            autocomplete="off"
            required
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

    <div class="mb-3">
        <div class="form-text">
            <b>{{ $t("Setup Instructions") }}:</b>
            <ol class="mb-0 mt-2">
                <li>{{ $t("halopsa_setup_step1") }}</li>
                <li>{{ $t("halopsa_setup_step2") }}</li>
                <li>{{ $t("halopsa_setup_step3") }}</li>
                <li>{{ $t("halopsa_setup_step4") }}</li>
            </ol>
        </div>
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
