<template>
    <div class="mb-3">
        <label for="signl4-webhook-url" class="form-label">{{ $t("SIGNL4 Webhook URL") }}</label>
        <input
            id="signl4-webhook-url"
            v-model="$parent.notification.webhookURL"
            type="url"
            pattern="https?://.+"
            class="form-control"
            required
        />
        <i18n-t tag="div" keypath="signl4Docs" class="form-text">
            <a href="https://docs.signl4.com/integrations/uptime-kuma/uptime-kuma.html" target="_blank">SIGNL4 Docs</a>
        </i18n-t>
    </div>
</template>
