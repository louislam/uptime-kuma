<template>
    <div class="mb-3">
        <label for="google-chat-webhook-url" class="form-label">{{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="google-chat-webhook-url" v-model="$parent.notification.googleChatWebhookURL" type="text" class="form-control" required>

        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px;">
                <a href="https://developers.google.com/chat/how-tos/webhooks" target="_blank">https://developers.google.com/chat/how-tos/webhooks</a>
            </i18n-t>
        </div>
    </div>
</template>
