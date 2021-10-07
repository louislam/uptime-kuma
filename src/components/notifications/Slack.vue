<template>
    <div class="mb-3">
        <label for="slack-webhook-url" class="form-label">{{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="slack-webhook-url" v-model="$parent.notification.slackwebhookURL" type="text" class="form-control" required>
        <label for="slack-username" class="form-label">{{ $t("Username") }}</label>
        <input id="slack-username" v-model="$parent.notification.slackusername" type="text" class="form-control">
        <label for="slack-iconemo" class="form-label">{{ $t("Icon Emoji") }}</label>
        <input id="slack-iconemo" v-model="$parent.notification.slackiconemo" type="text" class="form-control">
        <label for="slack-channel" class="form-label">{{ $t("Channel Name") }}</label>
        <input id="slack-channel-name" v-model="$parent.notification.slackchannel" type="text" class="form-control">

        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px;">
                <a href="https://api.slack.com/messaging/webhooks" target="_blank">https://api.slack.com/messaging/webhooks</a>
            </i18n-t>
            <p style="margin-top: 8px;">
                {{ $t("aboutChannelName", [$t("slack")]) }}
            </p>
            <p style="margin-top: 8px;">
                {{ $t("aboutKumaURL") }}
            </p>
            <i18n-t tag="p" keypath="emojiCheatSheet" style="margin-top: 8px;">
                <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">https://www.webfx.com/tools/emoji-cheat-sheet/</a>
            </i18n-t>
        </div>
    </div>
</template>
