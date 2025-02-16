<template>
    <div class="mb-3">
        <label for="bale-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput id="bale-bot-token" v-model="$parent.notification.baleBotToken" :required="true" autocomplete="new-password"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetBaleToken" class="form-text">
            <a href="https://ble.ir/BotFather" target="_blank">https://ble.ir/BotFather</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="bale-chat-id" class="form-label">{{ $t("Chat ID") }}</label>

        <div class="input-group mb-3">
            <input id="bale-chat-id" v-model="$parent.notification.baleChatID" type="text" class="form-control" required>
            <button v-if="$parent.notification.baleBotToken" class="btn btn-outline-secondary" type="button" @click="autoGetBaleChatID">
                {{ $t("Auto Get") }}
            </button>
        </div>

        <div class="form-text">
            {{ $t("supportBaleChatID") }}

            <p style="margin-top: 8px;">
                {{ $t("wayToGetBaleChatID") }}
            </p>

            <p style="margin-top: 8px;">
                <a :href="baleGetUpdatesURL('withToken')" target="_blank" style="word-break: break-word;">{{ baleGetUpdatesURL("masked") }}</a>
            </p>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import axios from "axios";

export default {
    components: {
        HiddenInput,
    },
    methods: {
        /**
         * Get the URL for bale updates
         * @param {string} mode Should the token be masked?
         * @returns {string} formatted URL
         */
        baleGetUpdatesURL(mode = "masked") {
            let token = `<${this.$t("YOUR BOT TOKEN HERE")}>`;

            if (this.$parent.notification.baleBotToken) {
                if (mode === "withToken") {
                    token = this.$parent.notification.baleBotToken;
                } else if (mode === "masked") {
                    token = "*".repeat(this.$parent.notification.baleBotToken.length);
                }
            }

            return `https://tapi.bale.ai/bot${token}/getUpdates`;
        },

        /**
         * Get the bale chat ID
         * @returns {Promise<void>}
         * @throws The chat ID could not be found
         */
        async autoGetBaleChatID() {
            try {
                let res = await axios.get(this.baleGetUpdatesURL("withToken"));

                if (res.data.result.length >= 1) {
                    let update = res.data.result[res.data.result.length - 1];

                    if (update.channel_post) {
                        this.$parent.notification.baleChatID = update.channel_post.chat.id;
                    } else if (update.message) {
                        this.$parent.notification.baleChatID = update.message.chat.id;
                    } else {
                        throw new Error(this.$t("chatIDNotFound"));
                    }

                } else {
                    throw new Error(this.$t("chatIDNotFound"));
                }

            } catch (error) {
                this.$root.toastError(error.message);
            }

        },
    }
};
</script>
