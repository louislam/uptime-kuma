<template>
    <div class="mb-3">
        <label for="mattermost-webhook-url" class="form-label">Webhook URL<span style="color:red;"><sup>*</sup></span></label>
        <input id="mattermost-webhook-url" v-model="$parent.notification.mattermostWebhookUrl" type="text" class="form-control" required>
        <label for="mattermost-username" class="form-label">Username</label>
        <input id="mattermost-username" v-model="$parent.notification.mattermostusername" type="text" class="form-control">
        <label for="mattermost-iconurl" class="form-label">Icon URL</label>
        <input id="mattermost-iconurl" v-model="$parent.notification.mattermosticonurl" type="text" class="form-control">
        <label for="mattermost-iconemo" class="form-label">Icon Emoji</label>
        <input id="mattermost-iconemo" v-model="$parent.notification.mattermosticonemo" type="text" class="form-control">
        <label for="mattermost-channel" class="form-label">Channel Name</label>
        <input id="mattermost-channel-name" v-model="$parent.notification.mattermostchannel" type="text" class="form-control">
        <div class="form-text">
            <span style="color:red;"><sup>*</sup></span>Required
            <p style="margin-top: 8px;">
                More info about webhooks on: <a href="https://docs.mattermost.com/developer/webhooks-incoming.html" target="_blank">https://docs.mattermost.com/developer/webhooks-incoming.html</a>
            </p>
            <p style="margin-top: 8px;">
                You can override the default channel that webhook posts to by entering the channel name into "Channel Name" field. This needs to be enabled in Mattermost webhook settings. Ex: #other-channel
            </p>
            <p style="margin-top: 8px;">
                If you leave the Uptime Kuma URL field blank, it will default to the Project Github page.
            </p>
            <p style="margin-top: 8px;">
                You can provide a link to a picture in "Icon URL" to override the default profile picture. Will not be used if Icon Emoji is set.
            </p>
            <p style="margin-top: 8px;">
                Emoji cheat sheet: <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">https://www.webfx.com/tools/emoji-cheat-sheet/</a> Note: emoji takes preference over Icon URL.
            </p>
        </div>
    </div>
</template>
