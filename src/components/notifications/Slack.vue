<template>
    <div class="mb-3">
        <label for="slack-webhook-url" class="form-label">Webhook URL<span style="color: red;"><sup>*</sup></span></label>
        <input id="slack-webhook-url" v-model="$parent.notification.slackwebhookURL" type="text" class="form-control" required>
        <label for="slack-username" class="form-label">Username</label>
        <input id="slack-username" v-model="$parent.notification.slackusername" type="text" class="form-control">
        <label for="slack-iconemo" class="form-label">Icon Emoji</label>
        <input id="slack-iconemo" v-model="$parent.notification.slackiconemo" type="text" class="form-control">
        <label for="slack-channel" class="form-label">Channel Name</label>
        <input id="slack-channel-name" v-model="$parent.notification.slackchannel" type="text" class="form-control">
        <label for="slack-button-url" class="form-label">Uptime Kuma URL</label>
        <input id="slack-button" v-model="$parent.notification.slackbutton" type="text" class="form-control">
        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>Required
            <p style="margin-top: 8px;">
                More info about webhooks on: <a href="https://api.slack.com/messaging/webhooks" target="_blank">https://api.slack.com/messaging/webhooks</a>
            </p>
            <p style="margin-top: 8px;">
                Enter the channel name on Slack Channel Name field if you want to bypass the webhook channel. Ex: #other-channel
            </p>
            <p style="margin-top: 8px;">
                If you leave the Uptime Kuma URL field blank, it will default to the Project Github page.
            </p>
            <p style="margin-top: 8px;">
                Emoji cheat sheet: <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">https://www.webfx.com/tools/emoji-cheat-sheet/</a>
            </p>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: "slack",
        }
    },
}
</script>
