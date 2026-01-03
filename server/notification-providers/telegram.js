const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { Liquid } = require("liquidjs");
const { DOWN } = require("../../src/util");

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
     * Renders template with optional MarkdownV2 escaping
     * @param {string} template The template
     * @param {string} msg Base message
     * @param {?object} monitorJSON Monitor details
     * @param {?object} heartbeatJSON Heartbeat details
     * @param {boolean} escapeMarkdown Whether to escape for MarkdownV2
     * @returns {Promise<string>} Rendered template
     */
    async renderTemplate(template, msg, monitorJSON, heartbeatJSON, escapeMarkdown = false) {
        const engine = new Liquid({
            root: "./no-such-directory-uptime-kuma",
            relativeReference: false,
            dynamicPartials: false,
        });

        const parsedTpl = engine.parse(template);

        // Defaults
        let monitorName = "Monitor Name not available";
        let monitorHostnameOrURL = "testing.hostname";

        if (monitorJSON !== null) {
            monitorName = monitorJSON.name;
            monitorHostnameOrURL = this.extractAddress(monitorJSON);
        }

        let serviceStatus = "⚠️ Test";
        if (heartbeatJSON !== null) {
            serviceStatus = heartbeatJSON.status === DOWN ? "🔴 Down" : "✅ Up";
        }

        // Escape values only when MarkdownV2 is enabled
        if (escapeMarkdown) {
            msg = this.escapeMarkdownV2(msg);
            monitorName = this.escapeMarkdownV2(monitorName);
            monitorHostnameOrURL = this.escapeMarkdownV2(monitorHostnameOrURL);
            serviceStatus = this.escapeMarkdownV2(serviceStatus);
        }

        const context = {
            // v1 compatibility (remove in v3)
            STATUS: serviceStatus,
            NAME: monitorName,
            HOSTNAME_OR_URL: monitorHostnameOrURL,

            // Official variables
            status: serviceStatus,
            name: monitorName,
            hostnameOrURL: monitorHostnameOrURL,
            monitorJSON,
            heartbeatJSON,
            msg,
        };

        return engine.render(parsedTpl, context);
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
                const escapeMarkdown = notification.telegramTemplateParseMode === "MarkdownV2";
                params.text = await this.renderTemplate(notification.telegramTemplate, msg, monitorJSON, heartbeatJSON, escapeMarkdown);

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
