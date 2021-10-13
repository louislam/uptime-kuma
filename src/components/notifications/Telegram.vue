<template>
    <div class="mb-3">
        <label for="telegram-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput id="telegram-bot-token" v-model="$parent.notification.telegramBotToken" :required="true" autocomplete="one-time-code"></HiddenInput>
        <div class="form-text">
            {{ $t("You can get a token from") }} <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>.
        </div>
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
                <template v-if="$parent.notification.telegramBotToken">
                    <a :href="telegramGetUpdatesURL" target="_blank" style="word-break: break-word;">{{ telegramGetUpdatesURL }}</a>
                </template>

                <template v-else>
                    {{ telegramGetUpdatesURL }}
                </template>
            </p>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import axios from "axios";
import { useToast } from "vue-toastification"
const toast = useToast();

export default {
    components: {
        HiddenInput,
    },
    computed: {
        telegramGetUpdatesURL() {
            let token = `<${this.$t("YOUR BOT TOKEN HERE")}>`

            if (this.$parent.notification.telegramBotToken) {
                token = this.$parent.notification.telegramBotToken;
            }

            return `https://api.telegram.org/bot${token}/getUpdates`;
        },
    },
    methods: {
        async autoGetTelegramChatID() {
            try {
                let res = await axios.get(this.telegramGetUpdatesURL)

                if (res.data.result.length >= 1) {
                    let update = res.data.result[res.data.result.length - 1]

                    if (update.channel_post) {
                        this.notification.telegramChatID = update.channel_post.chat.id;
                    } else if (update.message) {
                        this.notification.telegramChatID = update.message.chat.id;
                    } else {
                        throw new Error(this.$t("chatIDNotFound"))
                    }

                } else {
                    throw new Error(this.$t("chatIDNotFound"))
                }

            } catch (error) {
                toast.error(error.message)
            }

        },
    }
}
</script>
