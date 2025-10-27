const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Elks extends NotificationProvider {
    name = "Elks";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.46elks.com/a1/sms";

        try {
            let data = new URLSearchParams();
            data.append("from", notification.elksFromNumber);
            data.append("to", notification.elksToNumber );
            data.append("message", msg);

            let config = {
                headers: {
                    "Authorization": "Basic " + Buffer.from(`${notification.elksUsername}:${notification.elksAuthToken}`).toString("base64")
                }
            };

            config = this.getAxiosConfigWithProxy(config);

            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Elks;
