const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Keep extends NotificationProvider {
    name = "Keep";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {
                    "x-api-key": notification.webhookAPIKey,
                    "content-type": "application/json",
                },
            };

            let url = notification.webhookURL;

            if (url.endsWith("/")) {
                url = url.slice(0, -1);
            }

            let webhookURL = url + "/alerts/event/uptimekuma";

            config = this.getAxiosConfigWithProxy(config);

            await axios.post(webhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Keep;
