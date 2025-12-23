<template>
    <div class="mb-3">
        <label for="pumble-webhook-url" class="form-label mb-2">{{ $t("Webhook URL") }}</label><span style="color: red;"><sup>*</sup></span>
        <input id="pumble-webhook-url" v-model="$parent.notification.webhookURL" type="url" class="form-control" required>
    </div>
    <div class="mb-3">
        <a href="https://pumble.com/help/integrations/add-pumble-apps/incoming-webhooks-for-pumble/" target="_blank">{{ $t("documentationOf", ["Pumble Webbhook"]) }}</a>
    </div>
</template>
