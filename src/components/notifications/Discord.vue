<template>
    <div class="mb-3">
        <label for="discord-webhook-url" class="form-label">{{ $t("Discord Webhook URL") }}</label>
        <input id="discord-webhook-url" v-model="$parent.notification.discordWebhookUrl" type="text" class="form-control" required autocomplete="false">
        <div class="form-text">
            {{ $t("wayToGetDiscordURL") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="discord-username" class="form-label">{{ $t("Bot Display Name") }}</label>
        <input id="discord-username" v-model="$parent.notification.discordUsername" type="text" class="form-control" autocomplete="false" :placeholder="$root.appName">
    </div>

    <div class="mb-3">
        <label for="discord-prefix-message" class="form-label">{{ $t("Prefix Custom Message") }}</label>
        <input id="discord-prefix-message" v-model="$parent.notification.discordPrefixMessage" type="text" class="form-control" autocomplete="false" :placeholder="$t('Hello @everyone is...')">
    </div>

    <div class="mb-3">
        <label for="discord-message-type" class="form-label">{{ $t("Select message type") }}</label>
        <br>
        <select id="discord-message-type" class="form-select" v-model="$parent.notification.discordChannelType">
            <option value="normal">{{ $t("Normal Message") }}</option>
            <option value="createNewForumPost">{{ $t("Create new forum post") }}</option>
            <option value="postToThread">{{ $t("Post to existing thread") }}</option>
        </select>
    </div>

    <div v-if="$parent.notification.discordChannelType === 'createNewForumPost'">
        <div class="mb-3">
            <label for="discord-target" class="form-label">{{ $t("Forum post name") }}</label>
            <input id="discord-target" v-model="$parent.notification.postName" type="text" class="form-control" autocomplete="false" :placeholder="$t('Status Changed')">
        </div>
    </div>
    <div v-if="$parent.notification.discordChannelType === 'postToThread'">
        <div class="mb-3">
            <label for="discord-target" class="form-label">{{ $t("Thread ID") }}</label>
            <input id="discord-target" v-model="$parent.notification.threadId" type="text" class="form-control" autocomplete="false" :placeholder="$t('Thread ID (e.g. 1177566663751782411)')">
        </div>
    </div>
</template>
<script>
export default {
    mounted(){
        this.$parent.notification.discordChannelType = "normal";
    }
}
</script>