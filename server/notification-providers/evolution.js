const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Evolution extends NotificationProvider {
    name = "evolution";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "apikey": notification.evolutionAuthToken,
                }
            };
            config = this.getAxiosConfigWithProxy(config);

            let data = {
                "number": notification.evolutionRecipient,
                "text": msg,
            };

            let url = (notification.evolutionApiUrl || "https://evolapicloud.com/").replace(/([^/])\/+$/, "$1") + "/message/sendText/" + encodeURIComponent(notification.evolutionInstanceName);

            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Evolution;
