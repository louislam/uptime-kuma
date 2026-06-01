<template>
    <div class="mb-3">
        <label for="telegram-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput
            id="telegram-bot-token"
            v-model="$parent.notification.telegramBotToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetTelegramToken" class="form-text">
            <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="telegram-chat-id" class="form-label">{{ $t("Chat ID") }}</label>

        <div class="input-group mb-3">
            <input
                id="telegram-chat-id"
                v-model="$parent.notification.telegramChatID"
                type="text"
                class="form-control"
                required
            />
            <button
                v-if="$parent.notification.telegramBotToken"
                class="btn btn-outline-secondary"
                type="button"
                @click="autoGetTelegramChatID"
            >
                {{ $t("Auto Get") }}
            </button>
        </div>

        <div class="form-text">
            {{ $t("supportTelegramChatID") }}

            <p style="margin-top: 8px">
                {{ $t("wayToGetTelegramChatID") }}
            </p>

            <p style="margin-top: 8px">
                <a :href="telegramGetUpdatesURL('withToken')" target="_blank" style="word-break: break-word">
                    {{ telegramGetUpdatesURL("masked") }}
                </a>
            </p>
        </div>

        <label for="telegram-topic-name" class="form-label">{{ $t("telegramCreateTopic") }}</label>
        <div class="input-group mb-1">
            <input
                id="telegram-topic-name"
                v-model="$parent.notification.telegramTopicName"
                type="text"
                class="form-control"
                :placeholder="$t('telegramTopicNamePlaceholder')"
            />
            <button
                class="btn btn-outline-secondary"
                type="button"
                :disabled="!$parent.notification.telegramBotToken || !$parent.notification.telegramChatID"
                @click="createTelegramTopic"
            >
                {{ $t("Create") }}
            </button>
        </div>
        <p class="form-text">{{ $t("telegramCreateTopicDescription") }}</p>

        <label for="message_thread_id" class="form-label">{{ $t("telegramMessageThreadID") }}</label>
        <input
            id="message_thread_id"
            v-model="$parent.notification.telegramMessageThreadID"
            type="text"
            class="form-control"
        />
        <p class="form-text">{{ $t("telegramMessageThreadIDDescription") }}</p>

        <label for="server_url" class="form-label">{{ $t("telegramServerUrl") }}</label>
        <input id="server_url" v-model="$parent.notification.telegramServerUrl" type="text" class="form-control" />
        <div class="form-text">
            <i18n-t keypath="telegramServerUrlDescription">
                <a href="https://core.telegram.org/bots/api#using-a-local-bot-api-server" target="_blank">
                    {{ $t("here") }}
                </a>
                <a href="https://api.telegram.org" target="_blank">https://api.telegram.org</a>
            </i18n-t>
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.telegramUseTemplate" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("telegramUseTemplate") }}</label>
        </div>

        <div class="form-text">
            {{ $t("telegramUseTemplateDescription") }}
        </div>
    </div>

    <template v-if="$parent.notification.telegramUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="message_parse_mode">{{ $t("Message Format") }}</label>
            <select
                id="message_parse_mode"
                v-model="$parent.notification.telegramTemplateParseMode"
                class="form-select"
                required
            >
                <option value="plain">{{ $t("Plain Text") }}</option>
                <option value="HTML">HTML</option>
                <option value="MarkdownV2">MarkdownV2</option>
            </select>
            <i18n-t tag="p" keypath="telegramTemplateFormatDescription" class="form-text">
                <a href="https://core.telegram.org/bots/api#formatting-options" target="_blank">
                    {{ $t("documentation") }}
                </a>
            </i18n-t>

            <label class="form-label" for="message_template">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="message_template"
                v-model="$parent.notification.telegramTemplate"
                :required="true"
                :placeholder="telegramTemplatedTextareaPlaceholder"
            ></TemplatedTextarea>
        </div>
    </template>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.telegramSendSilently" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("telegramSendSilently") }}</label>
        </div>

        <div class="form-text">
            {{ $t("telegramSendSilentlyDescription") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.telegramProtectContent" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("telegramProtectContent") }}</label>
        </div>

        <div class="form-text">
            {{ $t("telegramProtectContentDescription") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";
import axios from "axios";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
    },
    computed: {
        telegramTemplatedTextareaPlaceholder() {
            return this.$t("Example:", [
                `
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}

{{ msg }}
                `,
            ]);
        },
    },
    mounted() {
        this.$parent.notification.telegramServerUrl ||= "https://api.telegram.org";
    },
    methods: {
        /**
         * Get the URL for telegram updates
         * @param {string} mode Should the token be masked?
         * @returns {string} formatted URL
         */
        telegramGetUpdatesURL(mode = "masked") {
            let token = `<${this.$t("YOUR BOT TOKEN HERE")}>`;

            if (this.$parent.notification.telegramBotToken) {
                if (mode === "withToken") {
                    token = this.$parent.notification.telegramBotToken;
                } else if (mode === "masked") {
                    token = "*".repeat(this.$parent.notification.telegramBotToken.length);
                }
            }

            return `${this.$parent.notification.telegramServerUrl}/bot${token}/getUpdates`;
        },

        /**
         * Get the telegram chat ID
         * @returns {Promise<void>}
         * @throws The chat ID could not be found
         */
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
                this.$root.toastError(error.message);
            }
        },

        /**
         * Create a new Telegram topic and use it for notifications
         * @returns {Promise<void>}
         * @throws The topic could not be created
         */
        async createTelegramTopic() {
            const name = (this.$parent.notification.telegramTopicName || "").trim();

            if (!name) {
                this.$root.toastError(this.$t("telegramTopicNameRequired"));
                return;
            }

            if (this.$parent.notification.telegramMessageThreadID) {
                this.$root.toastError(this.$t("telegramThreadAlreadyExists"));
                return;
            }

            try {
                const url = `${this.$parent.notification.telegramServerUrl}/bot${this.$parent.notification.telegramBotToken}/createForumTopic`;
                const res = await axios.post(url, {
                    chat_id: this.$parent.notification.telegramChatID,
                    name,
                });

                const threadID = res.data?.result?.message_thread_id;
                if (!threadID) {
                    throw new Error(this.$t("telegramTopicCreationFailed"));
                }

                this.$parent.notification.telegramMessageThreadID = threadID;
                this.$root.toastSuccess(this.$t("telegramTopicCreated"));
            } catch (error) {
                this.$root.toastError(error.response?.data?.description || error.message);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 150px;
}
</style>
