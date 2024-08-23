<template>
    <div class="mb-3">
        <label for="alertnow-webhook-url" class="form-label">{{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="alertnow-webhook-url" v-model="$parent.notification.alertNowWebhookURL" type="text" class="form-control" required>

        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px;">
                <a href="https://service.opsnow.com/docs/alertnow/en/user-guide-alertnow-en.html#standard" target="_blank">{{ $t("here") }}</a>
            </i18n-t>
        </div>
    </div>
</template>
