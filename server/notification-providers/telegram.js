const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const ProxyAgent = require("proxy-agent");

class Telegram extends NotificationProvider {
    name = "telegram";

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
            };
            if (notification.telegramMessageThreadID) {
                params.message_thread_id = notification.telegramMessageThreadID;
            }

            if (notification.telegramUseTemplate) {
                params.text = await this.renderTemplate(notification.telegramTemplate, msg, monitorJSON, heartbeatJSON);

                if (notification.telegramTemplateParseMode !== "plain") {
                    params.parse_mode = notification.telegramTemplateParseMode;
                }
            }

            // Proxy support
            let axiosConfig = { params };
            const proxyEnv = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
            if (proxyEnv) {
                // Use proxy-agent to support both http and https proxies
                const agent = new ProxyAgent(proxyEnv);
                axiosConfig.httpsAgent = agent;
                axiosConfig.httpAgent = agent;
                axiosConfig.proxy = false; // Disable axios's default proxy handling
            }

            await axios.get(`${url}/bot${notification.telegramBotToken}/sendMessage`, axiosConfig);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Telegram;
