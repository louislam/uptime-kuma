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
        <select id="discord-message-type" v-model="$parent.notification.discordChannelType" class="form-select">
            <option value="channel">{{ $t("Send to channel") }}</option>
            <option value="createNewForumPost">{{ $t("Create new forum post") }}</option>
            <option value="postToThread">{{ $t("postToExistingThread") }}</option>
        </select>
    </div>

    <div v-if="$parent.notification.discordChannelType === 'createNewForumPost'">
        <div class="mb-3">
            <label for="discord-target" class="form-label">
                <i18n-t keypath="forumPostName"></i18n-t>
            </label>
            <input id="discord-target" v-model="$parent.notification.postName" type="text" class="form-control" autocomplete="false">
            <div class="form-text">
                <i18n-t keypath="whatHappensAtForumPost"></i18n-t>
                "<i18n-t keypath="postToExistingThread"></i18n-t>"
            </div>
        </div>
    </div>
    <div v-if="$parent.notification.discordChannelType === 'postToThread'">
        <div class="mb-3">
            <label for="discord-target" class="form-label">
                <i18n-t keypath="threadForumPostID"></i18n-t>
            </label>
            <input id="discord-target" v-model="$parent.notification.threadId" type="text" class="form-control" autocomplete="false" :placeholder="$t('e.g. {discordThreadID}', { discordThreadID: 1177566663751782411 })">
            <div class="form-text">
                <i18n-t keypath="wayToGetDiscordThreadId"></i18n-t>
                <a
                    href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-"
                    target="_blank"
                >{{ $t("here") }}</a>
            </div>
        </div>
    </div>
</template>
<script>
export default {
    mounted() {
        if (!this.$parent.notification.discordChannelType) {
            this.$parent.notification.discordChannelType = "channel";
        }
    }
};
</script>
