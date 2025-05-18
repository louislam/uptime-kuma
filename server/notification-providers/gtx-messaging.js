const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class GtxMessaging extends NotificationProvider {
    name = "gtxmessaging";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        // The UP/DOWN symbols will be replaced with `???` by gtx-messaging
        const text = msg.replaceAll("🔴 ", "").replaceAll("✅ ", "");

        try {
            const data = new URLSearchParams();
            data.append("from", notification.gtxMessagingFrom.trim());
            data.append("to", notification.gtxMessagingTo.trim());
            data.append("text", text);

            const url = `https://rest.gtx-messaging.net/smsc/sendsms/${notification.gtxMessagingApiKey}/json`;

            await axios.post(url, data);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GtxMessaging;
