const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class MobivateSMS extends NotificationProvider {
    name = "MobivateSMS";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://vortex.mobivatebulksms.com/send/batch";

        try {
            // smspartner does not support non ascii characters and only a maximum 639 characters
            let cleanMsg = msg.replace(/[^\x00-\x7F]/g, "").substring(0, 639);

            let data = {
                "originator": notification.mobivateOriginator.substring(0, 15),
                "recipients": notification.mobivateRecipients.split(",").map(n => n.replace(/[^0-9]/g, "")).filter(n => n.length > 10),
                "text": cleanMsg
            };

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                    "Authorization": "Bearer " + notification.mobivateApikey
                }
            };
            config = this.getAxiosConfigWithProxy(config);

            let resp = await axios.post(url, data, config);

            if (resp.data.success !== true) {
                throw Error(`Api returned ${resp.data.response.status}.`);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = MobivateSMS;
