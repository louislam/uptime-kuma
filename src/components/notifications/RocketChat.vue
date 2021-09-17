<template>
    <div class="mb-3">
        <label for="rocket-webhook-url" class="form-label">Webhook URL<span style="color: red;"><sup>*</sup></span></label>
        <input id="rocket-webhook-url" v-model="$parent.notification.rocketwebhookURL" type="text" class="form-control" required>
        <label for="rocket-username" class="form-label">Username</label>
        <input id="rocket-username" v-model="$parent.notification.rocketusername" type="text" class="form-control">
        <label for="rocket-iconemo" class="form-label">Icon Emoji</label>
        <input id="rocket-iconemo" v-model="$parent.notification.rocketiconemo" type="text" class="form-control">
        <label for="rocket-channel" class="form-label">Channel Name</label>
        <input id="rocket-channel-name" v-model="$parent.notification.rocketchannel" type="text" class="form-control">
        <label for="rocket-button-url" class="form-label">Uptime Kuma URL</label>
        <input id="rocket-button" v-model="$parent.notification.rocketbutton" type="text" class="form-control">
        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>Required
            <p style="margin-top: 8px;">
                More info about webhooks on: <a href="https://docs.rocket.chat/guides/administration/administration/integrations" target="_blank">https://api.slack.com/messaging/webhooks</a>
            </p>
            <p style="margin-top: 8px;">
                Enter the channel name on Rocket.chat Channel Name field if you want to bypass the webhook channel. Ex: #other-channel
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
