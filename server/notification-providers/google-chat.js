const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL } = require("../../src/util");
const { UP } = require("../../src/util");

class GoogleChat extends NotificationProvider {

    name = "Google Chat";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            // Google Chat message formatting: https://developers.google.com/chat/api/guides/message-formats/basic

            let textMsg = ''
            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = `✅ Application is back online`;
            } else {
                textMsg = `🔴 Application went down`;
            }

            if (monitorJSON && monitorJSON.name) {
                textMsg += `\n*${monitorJSON.name}*`;
            }

            textMsg += `\n${msg}`;

            const baseURL = await setting("primaryBaseURL");
            if (baseURL) {
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
