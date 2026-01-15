const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Telegram extends NotificationProvider {
    name = "telegram";

    /**
     * Escapes special characters for Telegram MarkdownV2 format
     * @param {string} text Text to escape
     * @returns {string} Escaped text
     */
    escapeMarkdownV2(text) {
        if (!text) {
            return text;
        }

        // Characters that need to be escaped in MarkdownV2
        // https://core.telegram.org/bots/api#markdownv2-style
        return String(text).replace(/[_*[\]()~>#+\-=|{}.!\\]/g, "\\$&");
    }

    /**
     * Recursively escapes string properties of an object for Telegram MarkdownV2
     * @param {object|string} obj Object or string to escape
     * @returns {object|string} Escaped object or string
     */
    escapeObjectRecursive(obj) {
        if (typeof obj === "string") {
            return this.escapeMarkdownV2(obj);
        }
        if (typeof obj === "object" && obj !== null) {
            // Check if array
            if (Array.isArray(obj)) {
                return obj.map((item) => this.escapeObjectRecursive(item));
            }

            const newObj = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    newObj[key] = this.escapeObjectRecursive(obj[key]);
                }
            }
            return newObj;
        }
        return obj;
    }

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.telegramServerUrl ?? "https://api.telegram.org";

        try {
            let params = {
                chat_id: notification.telegramChatID,
                text: msg,
                disable_notification: notification.telegramSendSilently ?? false,
                protect_content: notification.telegramProtectContent ?? false,
                link_preview_options: { is_disabled: true },
            };
            if (notification.telegramMessageThreadID) {
                params.message_thread_id = notification.telegramMessageThreadID;
            }

            if (notification.telegramUseTemplate) {
                let monitorJSONCopy = monitorJSON;
                let heartbeatJSONCopy = heartbeatJSON;

                if (notification.telegramTemplateParseMode === "MarkdownV2") {
                    msg = this.escapeMarkdownV2(msg);

                    if (monitorJSONCopy) {
                        monitorJSONCopy = this.escapeObjectRecursive(monitorJSONCopy);
                    } else {
                        // for testing monitorJSON is null, provide escaped defaults
                        monitorJSONCopy = {
                            name: this.escapeMarkdownV2("Monitor Name not available"),
                            hostname: this.escapeMarkdownV2("testing.hostname"),
                            url: this.escapeMarkdownV2("testing.hostname"),
                        };
                    }

                    if (heartbeatJSONCopy) {
                        heartbeatJSONCopy = this.escapeObjectRecursive(heartbeatJSONCopy);
                    }
                }

                params.text = await this.renderTemplate(
                    notification.telegramTemplate,
                    msg,
                    monitorJSONCopy,
                    heartbeatJSONCopy
                );

                if (notification.telegramTemplateParseMode !== "plain") {
                    params.parse_mode = notification.telegramTemplateParseMode;
                }
            }

            let config = this.getAxiosConfigWithProxy();

            await axios.post(`${url}/bot${notification.telegramBotToken}/sendMessage`, params, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Telegram;
