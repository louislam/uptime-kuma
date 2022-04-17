const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL } = require("../../src/util");
const { DOWN, UP } = require("../../src/util");

class GoogleChat extends NotificationProvider {

    name = "GoogleChat";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            // Google Chat message formatting: https://developers.google.com/chat/api/guides/message-formats/basic

            let textMsg = "";
            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = "✅ Application is back online\n";
            } else if (heartbeatJSON && heartbeatJSON.status === DOWN) {
                textMsg = "🔴 Application went down\n";
            }

            if (monitorJSON && monitorJSON.name) {
                textMsg += `*${monitorJSON.name}*\n`;
            }

            textMsg += `${msg}`;

            const baseURL = await setting("primaryBaseURL");
            if (baseURL && monitorJSON) {
                textMsg += `\n${baseURL + getMonitorRelativeURL(monitorJSON.id)}`;
            }

            const data = {
                "text": textMsg,
            };

            await axios.post(notification.googleChatWebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = GoogleChat;
