<template>
    <div class="mb-3">
        <label for="mattermost-webhook-url" class="form-label">{{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="mattermost-webhook-url" v-model="$parent.notification.mattermostWebhookUrl" type="text" class="form-control" required>
        <label for="mattermost-username" class="form-label">{{ $t("Username") }}</label>
        <input id="mattermost-username" v-model="$parent.notification.mattermostusername" type="text" class="form-control">
        <label for="mattermost-iconurl" class="form-label">{{ $t("Icon URL") }}</label>
        <input id="mattermost-iconurl" v-model="$parent.notification.mattermosticonurl" type="text" class="form-control">
        <label for="mattermost-iconemo" class="form-label">{{ $t("Icon Emoji") }}</label>
        <input id="mattermost-iconemo" v-model="$parent.notification.mattermosticonemo" type="text" class="form-control">
        <label for="mattermost-channel" class="form-label">{{ $t("Channel Name") }}</label>
        <input id="mattermost-channel-name" v-model="$parent.notification.mattermostchannel" type="text" class="form-control">
        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px;">
                <a href="https://docs.mattermost.com/developer/webhooks-incoming.html" target="_blank">https://docs.mattermost.com/developer/webhooks-incoming.html</a>
            </i18n-t>
            <p style="margin-top: 8px;">
                {{ $t("aboutMattermostChannelName") }}
            </p>
            <p style="margin-top: 8px;">
                {{ $t("aboutKumaURL") }}
            </p>
            <p style="margin-top: 8px;">
                {{ $t("aboutIconURL") }}
            </p>
            <i18n-t tag="p" keypath="emojiCheatSheet" style="margin-top: 8px;">
                <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">https://www.webfx.com/tools/emoji-cheat-sheet/</a>
            </i18n-t>
        </div>
    </div>
</template>
