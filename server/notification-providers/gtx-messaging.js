const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class GtxMessaging extends NotificationProvider {
    name = "gtxmessaging";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let authKey = notification.gtxMessagingApiKey;
        let from = notification.gtxMessagingFrom.trim();
        let to = notification.gtxMessagingTo.trim();
        let text = msg.replaceAll("🔴 ", "").replaceAll("✅ ", "");

        try {

            let data = new URLSearchParams();
            data.append("from", from);
            data.append("to", to);
            data.append("text", text);

            let url = `https://rest.gtx-messaging.net/smsc/sendsms/${authKey}/json`;

            console.log(`will post url: ${url}, data:`, data);

            await axios.post(url, data);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GtxMessaging;
