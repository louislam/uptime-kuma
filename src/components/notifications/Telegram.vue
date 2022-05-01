<template>
    <div class="mb-3">
        <label for="telegram-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput id="telegram-bot-token" v-model="$parent.notification.telegramBotToken" :required="true" autocomplete="one-time-code"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetTelegramToken" class="form-text">
            <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="telegram-chat-id" class="form-label">{{ $t("Chat ID") }}</label>

        <div class="input-group mb-3">
            <input id="telegram-chat-id" v-model="$parent.notification.telegramChatID" type="text" class="form-control" required>
            <button v-if="$parent.notification.telegramBotToken" class="btn btn-outline-secondary" type="button" @click="autoGetTelegramChatID">
                {{ $t("Auto Get") }}
            </button>
        </div>

        <div class="form-text">
            {{ $t("supportTelegramChatID") }}

            <p style="margin-top: 8px;">
                {{ $t("wayToGetTelegramChatID") }}
            </p>

            <p style="margin-top: 8px;">
                <a :href="telegramGetUpdatesURL('withToken')" target="_blank" style="word-break: break-word;">{{ telegramGetUpdatesURL("masked") }}</a>
            </p>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import axios from "axios";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        HiddenInput,
    },
    methods: {
        telegramGetUpdatesURL(mode = "masked") {
            let token = `<${this.$t("YOUR BOT TOKEN HERE")}>`;

            if (this.$parent.notification.telegramBotToken) {
                if (mode === "withToken") {
                    token = this.$parent.notification.telegramBotToken;
                } else if (mode === "masked") {
                    token = "*".repeat(this.$parent.notification.telegramBotToken.length);
                }
            }

            return `https://api.telegram.org/bot${token}/getUpdates`;
        },
        async autoGetTelegramChatID() {
            try {
                let res = await axios.get(this.telegramGetUpdatesURL("withToken"));

                if (res.data.result.length >= 1) {
                    let update = res.data.result[res.data.result.length - 1];

                    if (update.channel_post) {
                        this.$parent.notification.telegramChatID = update.channel_post.chat.id;
                    } else if (update.message) {
                        this.$parent.notification.telegramChatID = update.message.chat.id;
                    } else {
                        throw new Error(this.$t("chatIDNotFound"));
                    }

                } else {
                    throw new Error(this.$t("chatIDNotFound"));
                }

            } catch (error) {
                toast.error(error.message);
            }

        },
    }
};
</script>
