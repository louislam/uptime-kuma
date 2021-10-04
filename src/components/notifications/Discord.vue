<template>
    <div class="mb-3">
        <label for="discord-webhook-url" class="form-label">Discord Webhook URL</label>
        <input id="discord-webhook-url" v-model="$parent.notification.discordWebhookUrl" type="text" class="form-control" required autocomplete="false">
        <div class="form-text">
            You can get this by going to Server Settings -> Integrations -> Create Webhook
        </div>
    </div>

    <div class="mb-3">
        <label for="discord-username" class="form-label">Bot Display Name</label>
        <input id="discord-username" v-model="$parent.notification.discordUsername" type="text" class="form-control" autocomplete="false" :placeholder="$root.appName">
    </div>


    <div class="mb-3">
        <label for="discord-prefix-message" class="form-label">Prefix Custom Message</label>
        <input id="discord-prefix-message" v-model="$parent.notification.discordPrefixMessage" type="text" class="form-control" autocomplete="false" placeholder="Hello @everyone is...">
    </div>
</template>
