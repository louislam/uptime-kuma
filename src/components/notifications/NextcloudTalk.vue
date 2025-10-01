<template>
    <div class="mb-3">
        <div class="mb-3">
            <label for="nextcloud-host" class="form-label">{{ $t("Nextcloud host") }}<span style="color: red;"><sup>*</sup></span></label>
            <input id="nextcloud-host" v-model="$parent.notification.host" type="text" class="form-control">
        </div>

        <div class="mb-3">
            <label for="nextcloud-conversation-token" class="form-label">{{ $t("Conversation token") }}<span style="color: red;"><sup>*</sup></span></label>
            <input id="nextcloud-conversation-token" v-model="$parent.notification.conversationToken" type="text" class="form-control">
        </div>

        <div class="mb-3">
            <label for="nextcloud-bot-secret" class="form-label">{{ $t("Bot secret") }}<span style="color: red;"><sup>*</sup></span></label>
            <HiddenInput id="nextcloud-bot-secret" v-model="$parent.notification.botSecret" :required="true" autocomplete="new-password"></HiddenInput>
        </div>

        <div class="mb-3">
            <div class="form-check form-switch">
                <input v-model="$parent.notification.sendSilentUp" class="form-check-input" type="checkbox">
                <label class="form-check-label">{{ $t("Send UP silently") }}</label>
            </div>
        </div>

        <div class="mb-3">
            <div class="form-check form-switch">
                <input v-model="$parent.notification.sendSilentDown" class="form-check-input" type="checkbox">
                <label class="form-check-label">{{ $t("Send DOWN silently") }}</label>
            </div>
        </div>

        <div class="mb-3">
            <div class="form-text">
                <p>{{ $t("Installing a Nextcloud Talk bot requires administrative access to the server.") }}</p>
                <p>{{ $t("Example:") }}</p>
                <pre># Setup bot
occ talk:bot:install \
    --feature response --no-setup \
    "Uptime Bot" "Secret" \
    https://uptime.domain.invalid

# Obtain BotId
occ talk:bot:list

# Add bot to a conversation
occ talk:bot:setup &lt;BotId&gt; &lt;ConversationToken&gt;
                </pre>

                <i18n-t tag="p" keypath="Read more:">
                    <a href="https://nextcloud-talk.readthedocs.io/en/latest/bot-list/#uptime-kuma" target="_blank">https://nextcloud-talk.readthedocs.io</a>
                </i18n-t>
            </div>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
